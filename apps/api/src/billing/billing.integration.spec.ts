import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 017-billing — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : provisionnement d'abonnement par le SUPER_ADMIN (§13.6),
// activation/renouvellement de licence pilotés par les évènements de
// paiement (§14.1), idempotence des évènements webhook, secret partagé
// du webhook (fail-closed), RBAC, isolation cross-tenant.
describe('Billing (017) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;
  let webhookSecret: string;
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
    webhookSecret = moduleRef.get(ConfigService).getOrThrow<string>('FACTURATION_WEBHOOK_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-billing-${suffix}@fotall.dev`,
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
        sousDomaine: `bill-${prefix}-${suffix}`,
        email: `admin@bill-${prefix}-${suffix}.dev`,
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
        montant: 35000,
        dateProchaineFacturation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
      });
  }

  it('SUPER_ADMIN provisionne un abonnement et la licence ESSAI devient ACTIVE', async () => {
    const { tenantId, token } = await registerTenant('provision');

    const creation = await creerAbonnement(tenantId);
    expect(creation.status).toBe(201);
    expect(creation.body.tenantId).toBe(tenantId);

    const statutLicence = await request(app.getHttpServer())
      .get('/licence/statut')
      .set('Authorization', `Bearer ${token}`);
    expect(statutLicence.body.statut).toBe('ACTIVE');

    const doublon = await creerAbonnement(tenantId);
    expect(doublon.status).toBe(409);
  });

  it('RBAC : ADMIN ne peut pas accéder aux routes de facturation Super-Admin', async () => {
    const { tenantId, token } = await registerTenant('rbac');

    const lecture = await request(app.getHttpServer())
      .get(`/super-admin/facturation/${tenantId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(lecture.status).toBe(403);

    const creation = await request(app.getHttpServer())
      .post(`/super-admin/facturation/${tenantId}/abonnement`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        plan: 'PRO',
        modePaiement: 'CARTE',
        montant: 1000,
        dateProchaineFacturation: new Date().toISOString(),
      });
    expect(creation.status).toBe(403);
  });

  describe('webhook de paiement', () => {
    it('refuse un appel sans secret ou avec un secret incorrect (fail-closed)', async () => {
      const sansSecret = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .send({ tenantId: 'x', type: 'PAIEMENT_REUSSI', idempotencyKey: randomUUID() });
      expect(sansSecret.status).toBe(403);

      const mauvaisSecret = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .set('X-Webhook-Secret', 'incorrect')
        .send({ tenantId: 'x', type: 'PAIEMENT_REUSSI', idempotencyKey: randomUUID() });
      expect(mauvaisSecret.status).toBe(403);
    });

    it('PAIEMENT_REUSSI renouvelle une licence déjà ACTIVE, de façon idempotente', async () => {
      const { tenantId, token } = await registerTenant('webhook-reussi');
      await creerAbonnement(tenantId);

      const idempotencyKey = randomUUID();
      const premier = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .set('X-Webhook-Secret', webhookSecret)
        .send({ tenantId, type: 'PAIEMENT_REUSSI', idempotencyKey, montant: 35000, devise: 'XOF' });
      expect(premier.status).toBe(201);

      const statutApresPremier = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${token}`);
      expect(statutApresPremier.body.statut).toBe('ACTIVE');
      const expirationApresPremier = statutApresPremier.body.dateExpirationCourante;

      // Rejeu du même évènement (retry réseau côté fournisseur) : ne doit
      // pas re-renouveler une seconde fois.
      const rejeu = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .set('X-Webhook-Secret', webhookSecret)
        .send({ tenantId, type: 'PAIEMENT_REUSSI', idempotencyKey, montant: 35000, devise: 'XOF' });
      expect(rejeu.status).toBe(201);

      const statutApresRejeu = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${token}`);
      expect(statutApresRejeu.body.dateExpirationCourante).toBe(expirationApresPremier);

      const facturation = await request(app.getHttpServer())
        .get(`/super-admin/facturation/${tenantId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(
        facturation.body.journal.filter(
          (entree: { idempotencyKey: string }) => entree.idempotencyKey === idempotencyKey,
        ),
      ).toHaveLength(1);
    });

    it('PAIEMENT_ECHEC marque l’abonnement EN_RETARD sans changer la licence', async () => {
      const { tenantId, token } = await registerTenant('webhook-echec');
      await creerAbonnement(tenantId);

      const avant = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${token}`);

      const echec = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .set('X-Webhook-Secret', webhookSecret)
        .send({ tenantId, type: 'PAIEMENT_ECHEC', idempotencyKey: randomUUID() });
      expect(echec.status).toBe(201);

      const apres = await request(app.getHttpServer())
        .get('/licence/statut')
        .set('Authorization', `Bearer ${token}`);
      expect(apres.body.statut).toBe(avant.body.statut);

      const facturation = await request(app.getHttpServer())
        .get(`/super-admin/facturation/${tenantId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(facturation.body.statut).toBe('EN_RETARD');
    });

    it('rejette un tenantId sans abonnement (404)', async () => {
      const { tenantId } = await registerTenant('sans-abonnement');

      const res = await request(app.getHttpServer())
        .post('/facturation/webhook')
        .set('X-Webhook-Secret', webhookSecret)
        .send({ tenantId, type: 'PAIEMENT_REUSSI', idempotencyKey: randomUUID() });
      expect(res.status).toBe(404);
    });
  });

  it('isolation cross-tenant : un évènement de paiement pour A ne modifie jamais la licence de B', async () => {
    const { tenantId: tenantAId } = await registerTenant('iso-a');
    const { tenantId: tenantBId, token: tokenB } = await registerTenant('iso-b');
    await creerAbonnement(tenantAId);

    const avantB = await request(app.getHttpServer())
      .get('/licence/statut')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(avantB.body.statut).toBe('ESSAI');

    await request(app.getHttpServer())
      .post('/facturation/webhook')
      .set('X-Webhook-Secret', webhookSecret)
      .send({ tenantId: tenantAId, type: 'PAIEMENT_REUSSI', idempotencyKey: randomUUID() });

    const apresB = await request(app.getHttpServer())
      .get('/licence/statut')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(apresB.body.statut).toBe('ESSAI');
    expect(tenantBId).not.toBe(tenantAId);
  });
});
