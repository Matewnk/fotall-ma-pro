import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 013-dashboard — preuve reelle contre PostgreSQL (pas de mock). Couvre
// les KPIs (§4.1), les commandes recentes (§4.2), les alertes (§4.3),
// l'isolation cross-tenant et le RBAC.
describe('Dashboard (013) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');
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
        sousDomaine: `dash-${prefix}-${suffix}`,
        email: `admin@dash-${prefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  async function creerClientEtService(bearer: string, tarif: number, codeSuffix: string) {
    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearer)
      .send({ nom: 'Client Dashboard', telephone: '+221701112233' });
    expect(client.status).toBe(201);
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', bearer)
      .send({
        code: `SRV-${codeSuffix}`,
        intitule: 'Service dashboard',
        categorie: 'LAVAGE',
        tarif,
      });
    expect(service.status).toBe(201);
    return { clientId: client.body.id as string, serviceId: service.body.id as string };
  }

  async function creerCommande(
    bearer: string,
    clientId: string,
    serviceId: string,
    quantite: number,
    extra: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', bearer)
      .send({
        clientId,
        articles: [{ serviceId, quantite }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body as { id: string; total: string };
  }

  it('KPIs de base : commandes du jour, chiffre d’affaires, articles en attente, commandes récentes', async () => {
    const { token } = await registerTenant('kpi');
    const bearer = `Bearer ${token}`;
    const { clientId, serviceId } = await creerClientEtService(bearer, 1000, '40');

    await creerCommande(bearer, clientId, serviceId, 2);
    await creerCommande(bearer, clientId, serviceId, 2);

    const dashboard = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearer);
    expect(dashboard.status).toBe(200);

    expect(dashboard.body.kpis.commandesDuJour).toBe(2);
    expect(dashboard.body.kpis.chiffreAffairesDuJour).toBe('4000');
    expect(dashboard.body.kpis.articlesEnAttente).toBe(4);
    expect(dashboard.body.commandesRecentes).toHaveLength(2);
    expect(dashboard.body.commandesRecentes[0]).toMatchObject({
      client: { nom: 'Client Dashboard' },
      statut: 'EN_ATTENTE',
      montant: '2000',
    });
    expect(dashboard.body.kpis.revenus7DerniersJours).toHaveLength(7);
  });

  it('retards et commandes urgentes se distinguent par la date prévue', async () => {
    const { token } = await registerTenant('retard');
    const bearer = `Bearer ${token}`;
    const { clientId, serviceId } = await creerClientEtService(bearer, 500, '41');

    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dansUneHeure = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const dansTroisJours = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    await creerCommande(bearer, clientId, serviceId, 1, { datePrevue: hier });
    await creerCommande(bearer, clientId, serviceId, 1, { datePrevue: dansUneHeure });
    await creerCommande(bearer, clientId, serviceId, 1, { datePrevue: dansTroisJours });

    const dashboard = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearer);
    expect(dashboard.status).toBe(200);

    expect(dashboard.body.kpis.commandesEnRetard).toBe(1);
    expect(dashboard.body.alertes.retards).toBe(1);
    expect(dashboard.body.alertes.commandesUrgentes).toBe(1);
  });

  it('livraisons prévues aujourd’hui filtre sur modeLivraison=LIVRAISON et la date du jour', async () => {
    const { token } = await registerTenant('livraison');
    const bearer = `Bearer ${token}`;
    const { clientId, serviceId } = await creerClientEtService(bearer, 500, '42');

    const aujourdHui = new Date().toISOString();
    const demain = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await creerCommande(bearer, clientId, serviceId, 1, {
      modeLivraison: 'LIVRAISON',
      adresseLivraison: '10 rue du Pressing',
      datePrevue: aujourdHui,
    });
    await creerCommande(bearer, clientId, serviceId, 1, { datePrevue: aujourdHui });
    await creerCommande(bearer, clientId, serviceId, 1, {
      modeLivraison: 'LIVRAISON',
      adresseLivraison: '10 rue du Pressing',
      datePrevue: demain,
    });

    const dashboard = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearer);
    expect(dashboard.status).toBe(200);

    expect(dashboard.body.kpis.livraisonsPrevuesAujourdHui).toBe(1);
    expect(dashboard.body.alertes.livraisonsDuJour).toBe(1);
  });

  it('paiementsEnAttente distingue les commandes soldées des commandes partiellement ou pas payées', async () => {
    const { token } = await registerTenant('paiement');
    const bearer = `Bearer ${token}`;
    const { clientId, serviceId } = await creerClientEtService(bearer, 1000, '43');

    const soldee = await creerCommande(bearer, clientId, serviceId, 1);
    const partielle = await creerCommande(bearer, clientId, serviceId, 1);
    await creerCommande(bearer, clientId, serviceId, 1);

    await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', bearer)
      .send({
        type: 'ENCAISSEMENT',
        montant: 1000,
        modePaiement: 'ESPECES',
        commandeId: soldee.id,
        idempotencyKey: randomUUID(),
      });
    await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', bearer)
      .send({
        type: 'ENCAISSEMENT',
        montant: 400,
        modePaiement: 'ESPECES',
        commandeId: partielle.id,
        idempotencyKey: randomUUID(),
      });

    const dashboard = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearer);
    expect(dashboard.status).toBe(200);

    expect(dashboard.body.alertes.paiementsEnAttente).toBe(2);
  });

  it('licenceProcheExpiration reflète le statut réel de la licence (essai neuf puis proche échéance)', async () => {
    const { token, tenantId } = await registerTenant('licence');
    const bearer = `Bearer ${token}`;

    const frais = await request(app.getHttpServer()).get('/dashboard').set('Authorization', bearer);
    expect(frais.body.alertes.licenceProcheExpiration.active).toBe(false);
    expect(frais.body.alertes.licenceProcheExpiration.joursRestants).toBeGreaterThan(1);

    const licence = await prisma.licence.findFirstOrThrow({ where: { tenantId } });
    await prisma.licence.update({
      where: { id: licence.id },
      data: { dateFinEssai: new Date(Date.now() + 10 * 60 * 60 * 1000) },
    });

    const proche = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearer);
    expect(proche.body.alertes.licenceProcheExpiration.active).toBe(true);
    expect(proche.body.alertes.licenceProcheExpiration.joursRestants).toBe(1);
  });

  it('isolation cross-tenant : le tableau de bord de A ne reflète jamais les commandes de B', async () => {
    const { token: tokenA } = await registerTenant('iso-a');
    const { token: tokenB } = await registerTenant('iso-b');
    const bearerA = `Bearer ${tokenA}`;
    const bearerB = `Bearer ${tokenB}`;
    const { clientId, serviceId } = await creerClientEtService(bearerA, 800, '44');

    await creerCommande(bearerA, clientId, serviceId, 1);
    await creerCommande(bearerA, clientId, serviceId, 1);
    await creerCommande(bearerA, clientId, serviceId, 1);

    const dashboardA = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearerA);
    const dashboardB = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', bearerB);

    expect(dashboardA.body.kpis.commandesDuJour).toBe(3);
    expect(dashboardB.body.kpis.commandesDuJour).toBe(0);
    expect(dashboardB.body.commandesRecentes).toHaveLength(0);
  });

  it('RBAC : TECHNICIEN et LIVREUR peuvent consulter le tableau de bord, un accès non authentifié est refusé', async () => {
    const { tenantId } = await registerTenant('rbac');

    const nonAuthentifie = await request(app.getHttpServer()).get('/dashboard');
    expect(nonAuthentifie.status).toBe(401);

    for (const role of [Role.TECHNICIEN, Role.LIVREUR]) {
      const suffix = randomUUID().slice(0, 8);
      const utilisateur = await prisma.user.create({
        data: {
          tenantId,
          role,
          email: `${role.toLowerCase()}-${suffix}@dash-rbac.dev`,
          motDePasseHash: 'n/a',
        },
      });
      const tokenRole = new JwtService({ secret: jwtSecret }).sign({
        sub: utilisateur.id,
        tenantId,
        role,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${tokenRole}`);
      expect(res.status).toBe(200);
    }
  });
});
