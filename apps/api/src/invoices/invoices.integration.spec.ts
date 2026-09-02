import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 023-subscriptions-invoicing — preuve reelle contre PostgreSQL.
// Couvre : génération sans ressaisie (snapshot), refus de double
// génération, PDF téléchargeable, changement de statut (annulée = état
// terminal), RBAC (SUPER_ADMIN uniquement — un ADMIN n'accède à AUCUNE de
// ces routes, même la sienne), historique d'abonnement au changement de
// plan.
describe('Invoices (023) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;
  let tokenSuperAdmin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-invoices-${suffix}@fotall.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenSuperAdmin = new JwtService({ secret: jwtSecret }).sign({
      sub: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(prefix: string) {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: `Pressing ${prefix}`,
        sousDomaine: `inv-${prefix}-${suffix}`,
        email: `admin@inv-${prefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  async function creerAbonnement(tenantId: string, overrides: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post(`/super-admin/facturation/${tenantId}/abonnement`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({
        plan: 'PRO',
        modePaiement: 'CARTE',
        montant: 79000,
        dateProchaineFacturation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
      });
  }

  it('génère une facture sans ressaisie (snapshot correct, numéro FAC-<année>-XXXX)', async () => {
    const { tenantId } = await registerTenant('gen');
    await creerAbonnement(tenantId);

    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(creation.status).toBe(201);
    expect(creation.body.numero).toMatch(/^FAC-\d{4}-\d{4}$/);
    expect(creation.body.montant).toBe(79000);
    expect(creation.body.nomPressingSnap).toContain('Pressing gen');
    expect(creation.body.statut).toBe('EMISE');

    const liste = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((f: { id: string }) => f.id)).toContain(creation.body.id);
  });

  it('refuse la double génération pour la même période (409)', async () => {
    const { tenantId } = await registerTenant('double');
    await creerAbonnement(tenantId);

    const premiere = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(premiere.status).toBe(201);

    const doublon = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(doublon.status).toBe(409);
  });

  it('tenant inexistant et tenant sans abonnement renvoient 404', async () => {
    const inexistant = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${randomUUID()}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(inexistant.status).toBe(404);

    const { tenantId } = await registerTenant('sans-abo');
    const sansAbonnement = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(sansAbonnement.status).toBe(404);
  });

  it('PDF téléchargeable (A4, en-tête application/pdf)', async () => {
    const { tenantId } = await registerTenant('pdf');
    await creerAbonnement(tenantId);
    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);

    const pdf = await request(app.getHttpServer())
      .get(`/super-admin/factures/${creation.body.id}/pdf`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(pdf.body) ? pdf.body.length : pdf.text.length).toBeGreaterThan(1000);
  });

  it('changement de statut : EMISE → PAYEE → ANNULEE, puis ANNULEE est un état terminal', async () => {
    const { tenantId } = await registerTenant('statut');
    await creerAbonnement(tenantId);
    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    const factureId: string = creation.body.id;

    const payee = await request(app.getHttpServer())
      .patch(`/super-admin/factures/${factureId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'PAYEE' });
    expect(payee.status).toBe(200);
    expect(payee.body.statut).toBe('PAYEE');

    const annulee = await request(app.getHttpServer())
      .patch(`/super-admin/factures/${factureId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'ANNULEE' });
    expect(annulee.status).toBe(200);
    expect(annulee.body.statut).toBe('ANNULEE');

    const reactivation = await request(app.getHttpServer())
      .patch(`/super-admin/factures/${factureId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'PAYEE' });
    expect(reactivation.status).toBe(409);

    // Une facture annulée reste consultable (jamais supprimée).
    const detail = await request(app.getHttpServer())
      .get(`/super-admin/factures/${factureId}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(detail.status).toBe(200);
    expect(detail.body.statut).toBe('ANNULEE');
  });

  it('Phase 12 : création de facture et changement de statut sont audités (utilisateur/action/tenant/date)', async () => {
    const { tenantId, token } = await registerTenant('audit');
    await creerAbonnement(tenantId);

    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(creation.status).toBe(201);

    const auditCreation = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${token}`)
      .query({ action: 'FACTURE_CREEE' });
    expect(auditCreation.status).toBe(200);
    expect(auditCreation.body).toHaveLength(1);
    expect(auditCreation.body[0].entityId).toBe(creation.body.id);
    expect(auditCreation.body[0].metadata.numero).toBe(creation.body.numero);

    await request(app.getHttpServer())
      .patch(`/super-admin/factures/${creation.body.id}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'ANNULEE' });

    const auditStatut = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${token}`)
      .query({ action: 'FACTURE_STATUT_MODIFIE' });
    expect(auditStatut.status).toBe(200);
    expect(auditStatut.body).toHaveLength(1);
    expect(auditStatut.body[0].metadata).toEqual({
      ancienStatut: 'EMISE',
      nouveauStatut: 'ANNULEE',
    });
  });

  it('RBAC : ADMIN n’accède à aucune route de facturation Super-Admin, même pour son propre tenant', async () => {
    const { tenantId, token } = await registerTenant('rbac');
    await creerAbonnement(tenantId);

    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${token}`);
    expect(creation.status).toBe(403);

    const liste = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${token}`);
    expect(liste.status).toBe(403);

    const listeGlobale = await request(app.getHttpServer())
      .get('/super-admin/factures')
      .set('Authorization', `Bearer ${token}`);
    expect(listeGlobale.status).toBe(403);
  });

  it('vue globale filtrable par tenant, plan et statut', async () => {
    const { tenantId } = await registerTenant('filtre');
    await creerAbonnement(tenantId, { plan: 'BUSINESS', montant: 120000 });
    const creation = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);

    const filtreTenant = await request(app.getHttpServer())
      .get('/super-admin/factures')
      .query({ tenantId })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtreTenant.body.map((f: { id: string }) => f.id)).toEqual([creation.body.id]);

    const filtrePlan = await request(app.getHttpServer())
      .get('/super-admin/factures')
      .query({ plan: 'BUSINESS' })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtrePlan.body.map((f: { id: string }) => f.id)).toContain(creation.body.id);

    const filtreStatut = await request(app.getHttpServer())
      .get('/super-admin/factures')
      .query({ statut: 'EMISE' })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtreStatut.body.map((f: { id: string }) => f.id)).toContain(creation.body.id);
  });

  it('historique abonnement : changer le plan trace ancien/nouveau plan et prix', async () => {
    const { tenantId } = await registerTenant('historique');
    await creerAbonnement(tenantId, { plan: 'STARTER', montant: 15000 });

    const changement = await request(app.getHttpServer())
      .patch(`/super-admin/tenants/${tenantId}/plan`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ plan: 'PRO', nouveauMontant: 79000, motif: 'Passage au plan Pro' });
    expect(changement.status).toBe(200);

    const historique = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantId}/historique-abonnement`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(historique.status).toBe(200);
    expect(historique.body).toHaveLength(1);
    expect(historique.body[0].ancienPlan).toBe('STARTER');
    expect(historique.body[0].nouveauPlan).toBe('PRO');
    expect(historique.body[0].ancienPrix).toBe(15000);
    expect(historique.body[0].nouveauPrix).toBe(79000);
    expect(historique.body[0].motif).toBe('Passage au plan Pro');

    const abonnementApres = await request(app.getHttpServer())
      .get(`/super-admin/facturation/${tenantId}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(abonnementApres.body.plan).toBe('PRO');
    expect(Number(abonnementApres.body.montant)).toBe(79000);
  });
});
