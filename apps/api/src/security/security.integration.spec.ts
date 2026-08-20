import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';

// Spec 018-audit-security — preuve reelle contre PostgreSQL (pas de
// mock). Etend la preuve d'isolation "RELEASE BLOCKER" de 003
// (tenant-isolation.integration.spec.ts, limitee a l'epoque a AuditLog,
// seule entite existante) aux entites metier introduites depuis
// (clients/007, commandes/009, caisse/010, rapports/014, facturation/017)
// et consolide le tableau RBAC (§21.3) en un seul endroit — cahier des
// charges §19.5 : cross-tenant, ID forge, JWT forge, export cross-tenant,
// job cross-tenant, permissions RBAC.
//
// Toujours hors perimetre (aucun sous-systeme correspondant n'existe) :
// cache (aucun Redis branche), fichiers (aucun stockage implemente), API
// keys (spec 019-open-api).
describe('Sécurité transverse (018) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantPrisma: TenantPrismaFactory;
  let billingService: BillingService;
  let jwtSecret: string;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let tokenSuperAdmin: string;
  let clientAId: string;
  let commandeAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    billingService = moduleRef.get(BillingService);
    tenantPrisma = moduleRef.get(TenantPrismaFactory);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);

    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Sécurité A',
        sousDomaine: `sec-a-${suffix}`,
        email: 'admin@pressing-sec-a.dev',
        motDePasse: 'super-secret-a1',
      });
    expect(registerA.status).toBe(201);
    tenantAId = registerA.body.tenant.id;
    userAId = registerA.body.user.id;
    tokenAdminA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Sécurité B',
        sousDomaine: `sec-b-${suffix}`,
        email: 'admin@pressing-sec-b.dev',
        motDePasse: 'super-secret-b1',
      });
    expect(registerB.status).toBe(201);
    tenantBId = registerB.body.tenant.id;
    tokenAdminB = registerB.body.accessToken;

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-sec-${suffix}@fotall.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenSuperAdmin = new JwtService({ secret: jwtSecret }).sign({
      sub: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
    });

    const clientA = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nom: 'Client A', telephone: '+221701112233' });
    clientAId = clientA.body.id;

    const serviceA = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-60', intitule: 'Service sécurité', categorie: 'LAVAGE', tarif: 1000 });

    const commandeA = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceA.body.id, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    commandeAId = commandeA.body.id;

    await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        type: 'ENCAISSEMENT',
        montant: 1000,
        modePaiement: 'ESPECES',
        idempotencyKey: randomUUID(),
      });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('accès direct par ID (§19.5 "ID forgé")', () => {
    it('Client : A ne peut jamais lire un client de B par ID direct', async () => {
      const clientB = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ nom: 'Client B', telephone: '+221709998877' });

      const res = await request(app.getHttpServer())
        .get(`/clients/${clientB.body.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(404);
    });

    it('Commande : A ne peut jamais lire ou modifier une commande de B par ID direct', async () => {
      const clientB = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ nom: 'Client B2', telephone: '+221709998811' });
      const serviceB = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ code: 'SRV-61', intitule: 'Service B', categorie: 'LAVAGE', tarif: 500 });
      const commandeB = await request(app.getHttpServer())
        .post('/commandes')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({
          clientId: clientB.body.id,
          articles: [{ serviceId: serviceB.body.id, quantite: 1 }],
          modeLivraison: 'RETRAIT',
          idempotencyKey: randomUUID(),
        });

      const lecture = await request(app.getHttpServer())
        .get(`/commandes/${commandeB.body.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(lecture.status).toBe(404);

      const modification = await request(app.getHttpServer())
        .patch(`/commandes/${commandeB.body.id}/statut`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ statut: 'EN_COURS' });
      expect(modification.status).toBe(404);
    });

    it('UPDATE/DELETE direct en base : physiquement impossible de toucher une ligne du schéma de B depuis A', async () => {
      await expect(
        tenantPrisma.forTenant(tenantAId).commande.update({
          where: { id: commandeAId },
          data: { statut: 'LIVRE' },
        }),
      ).resolves.toBeDefined();

      await expect(
        tenantPrisma.forTenant(tenantBId).commande.findUnique({ where: { id: commandeAId } }),
      ).resolves.toBeNull();
    });
  });

  describe('listes et recherches jamais fuitées (§19.5 "recherche cross-tenant")', () => {
    it('LIST commandes : A ne voit jamais les commandes de B', async () => {
      const res = await request(app.getHttpServer())
        .get('/commandes')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(commandeAId);

      const commandesB = await tenantPrisma.forTenant(tenantBId).commande.findMany({});
      for (const commandeB of commandesB) {
        expect(ids).not.toContain(commandeB.id);
      }
    });

    it('LIST journal de caisse : jamais d’opération de B chez A', async () => {
      const journalA = await request(app.getHttpServer())
        .get('/caisse/operations')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      const journalB = await tenantPrisma.forTenant(tenantBId).operationCaisse.findMany({});
      const idsA = journalA.body.map((op: { id: string }) => op.id);
      for (const opB of journalB) {
        expect(idsA).not.toContain(opB.id);
      }
    });
  });

  describe('JWT falsifié contre une écriture métier réelle (§19.5 "JWT incorrect")', () => {
    it('rejette un JWT dont le tenant_id ne correspond pas à l’utilisateur en base, sur POST /commandes', async () => {
      const forgedToken = new JwtService({ secret: jwtSecret }).sign({
        sub: userAId,
        tenantId: tenantBId,
        role: Role.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .post('/commandes')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({
          clientId: clientAId,
          articles: [{ serviceId: 'peu-importe', quantite: 1 }],
          modeLivraison: 'RETRAIT',
          idempotencyKey: randomUUID(),
        });
      expect(res.status).toBe(401);
    });

    it('un tenant_id fourni dans le corps d’une requête est toujours ignoré (whitelist DTO)', async () => {
      const res = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ nom: 'Client Falsifié', telephone: '+221700000001', tenantId: tenantBId });
      expect(res.status).toBe(400);
    });
  });

  describe('export cross-tenant (§19.5 "export cross-tenant")', () => {
    it('un export CSV de A ne contient jamais une donnée de B', async () => {
      const clientB = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ nom: 'ClientNomUniqueTenantB', telephone: '+221709998822' });
      const serviceB = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({
          code: 'SRV-62',
          intitule: 'ServiceUniqueTenantB',
          categorie: 'LAVAGE',
          tarif: 999,
        });
      await request(app.getHttpServer())
        .post('/commandes')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({
          clientId: clientB.body.id,
          articles: [{ serviceId: serviceB.body.id, quantite: 1 }],
          modeLivraison: 'RETRAIT',
          idempotencyKey: randomUUID(),
        });

      const exportA = await request(app.getHttpServer())
        .get('/rapports/top-clients')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(exportA.status).toBe(200);
      expect(exportA.text).not.toContain('ClientNomUniqueTenantB');
    });
  });

  describe('facturation Super-Admin : jamais de fuite entre tenants', () => {
    it('GET /super-admin/facturation/:tenantId ne retourne que les données du tenant demandé', async () => {
      await request(app.getHttpServer())
        .post(`/super-admin/facturation/${tenantAId}/abonnement`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({
          plan: 'PRO',
          modePaiement: 'CARTE',
          montant: 1000,
          dateProchaineFacturation: new Date().toISOString(),
        });

      const facturationB = await request(app.getHttpServer())
        .get(`/super-admin/facturation/${tenantBId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(facturationB.status).toBe(404);
    });
  });

  describe('permissions RBAC (§21.3, consolidé)', () => {
    it.each([
      ['/rapports/activite', 'get', Role.CAISSIER],
      ['/super-admin/facturation/x/abonnement', 'post', Role.ADMIN],
      ['/super-admin/tenants', 'get', Role.ADMIN],
      ['/services', 'post', Role.CAISSIER],
      ['/caisse/operations', 'post', Role.TECHNICIEN],
    ])('%s (%s) refuse le rôle %s (403)', async (route, method, role) => {
      const suffix = randomUUID().slice(0, 8);
      const utilisateur = await prisma.user.create({
        data: {
          tenantId: tenantAId,
          role,
          email: `${role.toLowerCase()}-${suffix}@sec-rbac.dev`,
          motDePasseHash: 'n/a',
        },
      });
      const token = new JwtService({ secret: jwtSecret }).sign({
        sub: utilisateur.id,
        tenantId: tenantAId,
        role,
      });

      const agent = request(app.getHttpServer());
      const req = method === 'get' ? agent.get(route) : agent.post(route);
      const res = await req.set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(403);
    });

    it('accès non authentifié refusé sur un échantillon représentatif de routes', async () => {
      const routes = [
        '/commandes',
        '/clients',
        '/services',
        '/caisse/operations',
        '/rapports/activite',
        '/dashboard',
      ];
      for (const route of routes) {
        const res = await request(app.getHttpServer()).get(route);
        expect(res.status).toBe(401);
      }
    });
  });

  describe('job planifié cross-tenant (§19.5 "job cross-tenant")', () => {
    it('la relance de facturation en retard de A suspend sa licence sans jamais toucher B', async () => {
      const { token: tokenAdminC } = await registerTenantAvecAbonnementEnRetard();

      const licenceBAvant = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(licenceBAvant.body.statut).toBe('ESSAI');

      await billingService.relancerAbonnementsEnRetard();

      const licenceCApres = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${tokenAdminC}`);
      expect(licenceCApres.body.statut).toBe('SUSPENDUE');

      const licenceBApres = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(licenceBApres.body.statut).toBe('ESSAI');
    });
  });

  async function registerTenantAvecAbonnementEnRetard() {
    const suffix = randomUUID().slice(0, 8);
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Relance',
        sousDomaine: `sec-relance-${suffix}`,
        email: `admin@sec-relance-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(register.status).toBe(201);
    const tenantId = register.body.tenant.id as string;
    const token = register.body.accessToken as string;

    await prisma.licence.update({ where: { tenantId }, data: { statut: 'ACTIVE' } });
    await prisma.abonnement.create({
      data: {
        tenantId,
        plan: 'STARTER',
        modePaiement: 'CARTE',
        montant: 1000,
        statut: 'EN_RETARD',
        dateProchaineFacturation: new Date(),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { tenantId, token };
  }
});
