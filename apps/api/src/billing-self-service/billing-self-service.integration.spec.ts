import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 023-subscriptions-invoicing, Phase 2 — preuve reelle contre
// PostgreSQL. Couvre : lecture seule (abonnement/factures/paiements/plans)
// tenant-scopée depuis le JWT, permission facturation.read (ADMIN par
// défaut, CAISSIER/TECHNICIEN/LIVREUR 403 par défaut, configurable via
// override 021 sans nouveau mécanisme), isolation cross-tenant (404 jamais
// 403 sur la facture d'un autre tenant). Couvre aussi le renouvellement
// self-service (ADR-007) : montant recalculé côté serveur, confirmation
// DRY_RUN, prolongation Abonnement + Licence, permission
// facturation.renouveler.
describe('Billing self-service (023 Phase 2) — PostgreSQL réel', () => {
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
        email: `super-selfservice-${suffix}@fotall.dev`,
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
        sousDomaine: `ss-${prefix}-${suffix}`,
        email: `admin@ss-${prefix}-${suffix}.dev`,
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

  function creerUtilisateur(tenantId: string, role: Role, suffix: string) {
    return prisma.user
      .create({
        data: {
          tenantId,
          role,
          email: `${role.toLowerCase()}-${suffix}@ss.dev`,
          motDePasseHash: 'n/a',
        },
      })
      .then((utilisateur) =>
        new JwtService({ secret: jwtSecret }).sign({
          sub: utilisateur.id,
          tenantId,
          role,
        }),
      )
      .then((token) => ({ token }));
  }

  it('ADMIN consulte son abonnement, ses factures et le catalogue de plans', async () => {
    const { tenantId, token } = await registerTenant('lecture');
    await creerAbonnement(tenantId);
    const facture = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(facture.status).toBe(201);

    const abonnement = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${token}`);
    expect(abonnement.status).toBe(200);
    expect(abonnement.body.plan).toBe('PRO');
    expect(abonnement.body.journal).toBeDefined();

    const factures = await request(app.getHttpServer())
      .get('/factures')
      .set('Authorization', `Bearer ${token}`);
    expect(factures.status).toBe(200);
    expect(factures.body.map((f: { id: string }) => f.id)).toContain(facture.body.id);

    const detail = await request(app.getHttpServer())
      .get(`/factures/${facture.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.numero).toBe(facture.body.numero);

    const pdf = await request(app.getHttpServer())
      .get(`/factures/${facture.body.id}/pdf`)
      .set('Authorization', `Bearer ${token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const plans = await request(app.getHttpServer())
      .get('/plans')
      .set('Authorization', `Bearer ${token}`);
    expect(plans.status).toBe(200);
    expect(plans.body.map((p: { plan: string }) => p.plan).sort()).toEqual(
      ['BUSINESS', 'PRO', 'STARTER'].sort(),
    );
  });

  it('isolation cross-tenant : ADMIN Tenant A ne peut jamais consulter une facture de Tenant B (404, jamais 403)', async () => {
    const { tenantId: tenantAId } = await registerTenant('iso-a');
    const { token: tokenB } = await registerTenant('iso-b');
    await creerAbonnement(tenantAId);
    const factureA = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);

    const detailDepuisB = await request(app.getHttpServer())
      .get(`/factures/${factureA.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(detailDepuisB.status).toBe(404);

    const pdfDepuisB = await request(app.getHttpServer())
      .get(`/factures/${factureA.body.id}/pdf`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(pdfDepuisB.status).toBe(404);

    const listeB = await request(app.getHttpServer())
      .get('/factures')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listeB.body.map((f: { id: string }) => f.id)).not.toContain(factureA.body.id);
  });

  it('permission facturation.read : ADMIN par défaut, CAISSIER/TECHNICIEN/LIVREUR 403 par défaut', async () => {
    const { tenantId, token: tokenAdmin } = await registerTenant('rbac');
    await creerAbonnement(tenantId);
    const suffix = randomUUID().slice(0, 8);

    const abonnementAdmin = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(abonnementAdmin.status).toBe(200);

    for (const role of [Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR]) {
      const { token } = await creerUtilisateur(tenantId, role, `${suffix}-${role}`);
      const abonnement = await request(app.getHttpServer())
        .get('/abonnement')
        .set('Authorization', `Bearer ${token}`);
      expect(abonnement.status).toBe(403);
      const factures = await request(app.getHttpServer())
        .get('/factures')
        .set('Authorization', `Bearer ${token}`);
      expect(factures.status).toBe(403);
      const plans = await request(app.getHttpServer())
        .get('/plans')
        .set('Authorization', `Bearer ${token}`);
      expect(plans.status).toBe(403);
    }
  });

  it('GET /abonnement inclut l’état de la licence (statut, dateActivation, dateExpirationCourante)', async () => {
    const { tenantId, token } = await registerTenant('lic');
    await creerAbonnement(tenantId);

    const abonnement = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${token}`);
    expect(abonnement.status).toBe(200);
    expect(abonnement.body.licence).toBeDefined();
    expect(abonnement.body.licence.statut).toBe('ACTIVE');
    // PAYTECH_DRY_RUN non configuré dans cet environnement de test →
    // défaut "true" (voir PaytechService#estDryRun).
    expect(abonnement.body.paiementEnLigneDisponible).toBe(true);
  });

  it('Renouvellement self-service : ADMIN choisit une durée, montant recalculé côté serveur, jamais celui envoyé par le client', async () => {
    const { tenantId, token } = await registerTenant('renouv');
    await creerAbonnement(tenantId, { montant: 35000 });

    // Le DTO n'accepte que dureeMois (whitelist + forbidNonWhitelisted
    // globaux) : un montant fourni par le client serait rejeté (400) avant
    // même d'atteindre le service — la preuve la plus directe que le
    // montant n'est jamais accepté du client.
    const avecMontantForge = await request(app.getHttpServer())
      .post('/abonnement/renouvellement')
      .set('Authorization', `Bearer ${token}`)
      .send({ dureeMois: 12, montant: 1 });
    expect(avecMontantForge.status).toBe(400);

    const renouvellement = await request(app.getHttpServer())
      .post('/abonnement/renouvellement')
      .set('Authorization', `Bearer ${token}`)
      .send({ dureeMois: 12 });
    expect(renouvellement.status).toBe(201);
    expect(renouvellement.body.mode).toBe('DRY_RUN');
    expect(renouvellement.body.montant).toBe(420000); // 35000 × 12, jamais 1
    expect(renouvellement.body.dureeMois).toBe(12);
    expect(renouvellement.body.token).toBeDefined();
    expect(renouvellement.body.redirectUrl).toContain(renouvellement.body.token);

    const audit = await request(app.getHttpServer())
      .get('/audit')
      .query({ action: 'FACTURE_RENOUVELLEMENT_INITIE' })
      .set('Authorization', `Bearer ${token}`);
    expect(
      audit.body.some(
        (entree: { entityId: string }) => entree.entityId === renouvellement.body.factureId,
      ),
    ).toBe(true);
  });

  it('Confirmation DRY_RUN : facture PAYEE, abonnement prolongé, licence prolongée, paiement journalisé', async () => {
    const { tenantId, token } = await registerTenant('confirm');
    await creerAbonnement(tenantId, { montant: 35000 });

    const renouvellement = await request(app.getHttpServer())
      .post('/abonnement/renouvellement')
      .set('Authorization', `Bearer ${token}`)
      .send({ dureeMois: 3 });
    const factureId = renouvellement.body.factureId as string;

    const confirmation = await request(app.getHttpServer())
      .post(`/factures/${factureId}/confirmer-dry-run`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmation.status).toBe(201);
    expect(confirmation.body.mode).toBe('DRY_RUN');
    expect(confirmation.body.facture.statut).toBe('PAYEE');

    const abonnementApres = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${token}`);
    expect(abonnementApres.body.statut).toBe('ACTIF');
    expect(abonnementApres.body.licence.statut).toBe('ACTIVE');
    expect(new Date(abonnementApres.body.licence.dateExpirationCourante).getTime()).toBeGreaterThan(
      Date.now() + 80 * 24 * 60 * 60 * 1000,
    ); // ~90j (3 mois) - marge

    const journal = abonnementApres.body.journal as { type: string; idempotencyKey: string }[];
    expect(
      journal.some(
        (entree) =>
          entree.type === 'PAIEMENT_REUSSI' &&
          entree.idempotencyKey === `dry-run-confirm:${factureId}`,
      ),
    ).toBe(true);
  });

  it('Confirmation DRY_RUN : rejette une facture déjà PAYEE (double confirmation impossible)', async () => {
    const { tenantId, token } = await registerTenant('confirm-double');
    await creerAbonnement(tenantId);

    const renouvellement = await request(app.getHttpServer())
      .post('/abonnement/renouvellement')
      .set('Authorization', `Bearer ${token}`)
      .send({ dureeMois: 1 });
    const factureId = renouvellement.body.factureId as string;

    const premiere = await request(app.getHttpServer())
      .post(`/factures/${factureId}/confirmer-dry-run`)
      .set('Authorization', `Bearer ${token}`);
    expect(premiere.status).toBe(201);

    const seconde = await request(app.getHttpServer())
      .post(`/factures/${factureId}/confirmer-dry-run`)
      .set('Authorization', `Bearer ${token}`);
    expect(seconde.status).toBe(409);
  });

  it('Renouvellement self-service : isolation cross-tenant — Tenant B ne peut jamais confirmer une facture de Tenant A (404, jamais 403)', async () => {
    const { tenantId: tenantAId } = await registerTenant('renouv-iso-a');
    const { token: tokenB } = await registerTenant('renouv-iso-b');
    await creerAbonnement(tenantAId);
    const factureA = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/factures`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(factureA.body.statut).toBe('EMISE');

    const confirmationDepuisB = await request(app.getHttpServer())
      .post(`/factures/${factureA.body.id}/confirmer-dry-run`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(confirmationDepuisB.status).toBe(404);
  });

  it('Renouvellement self-service : permission facturation.renouveler — ADMIN par défaut, CAISSIER/TECHNICIEN/LIVREUR 403 par défaut', async () => {
    const { tenantId } = await registerTenant('renouv-rbac');
    await creerAbonnement(tenantId);
    const suffix = randomUUID().slice(0, 8);

    for (const role of [Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR]) {
      const { token } = await creerUtilisateur(tenantId, role, `${suffix}-${role}`);
      const renouvellement = await request(app.getHttpServer())
        .post('/abonnement/renouvellement')
        .set('Authorization', `Bearer ${token}`)
        .send({ dureeMois: 1 });
      expect(renouvellement.status).toBe(403);
    }
  });

  it('Renouvellement self-service : rejette une durée hors catalogue (1/3/6/12 uniquement)', async () => {
    const { tenantId, token } = await registerTenant('renouv-duree');
    await creerAbonnement(tenantId);

    const renouvellement = await request(app.getHttpServer())
      .post('/abonnement/renouvellement')
      .set('Authorization', `Bearer ${token}`)
      .send({ dureeMois: 2 });
    expect(renouvellement.status).toBe(400);
  });

  it('permission facturation.read reste configurable via le mécanisme d’override 021 existant', async () => {
    const { tenantId, token: tokenAdmin } = await registerTenant('override');
    await creerAbonnement(tenantId);
    const suffix = randomUUID().slice(0, 8);
    const caissier = await prisma.user.create({
      data: {
        tenantId,
        role: Role.CAISSIER,
        email: `caissier-override-${suffix}@ss.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId,
      role: Role.CAISSIER,
    });

    const avant = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(avant.status).toBe(403);

    const override = await request(app.getHttpServer())
      .put(`/users/${caissier.id}/permissions/facturation.read`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ effet: 'ALLOW' });
    expect(override.status).toBe(200);

    const apres = await request(app.getHttpServer())
      .get('/abonnement')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(apres.status).toBe(200);
  });
});
