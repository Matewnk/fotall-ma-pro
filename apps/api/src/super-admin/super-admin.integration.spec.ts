import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 005-super-admin — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : ADMIN -> 403 sur tout /super-admin/*, gestion des tenants,
// statistiques globales, et le mode support (motif obligatoire, aucun
// acces sans session active, audit debut/fin, une seule session
// concurrente par tenant/super-admin).
describe('Super-Admin (005) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let sousDomaineA: string;
  let tokenAdminA: string;
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
    sousDomaineA = `sup-a-${suffix}`;
    const registerA = await request(app.getHttpServer()).post('/auth/register').send({
      nomPressing: 'Pressing Support',
      sousDomaine: sousDomaineA,
      email: 'admin@pressing-support.dev',
      motDePasse: 'super-secret-a1',
    });
    expect(registerA.status).toBe(201);
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-${suffix}@fotall.dev`,
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

  it('ADMIN tenant → 403 sur toutes les routes /super-admin/*', async () => {
    const routes: [string, 'get' | 'post'][] = [
      [`/super-admin/tenants`, 'get'],
      [`/super-admin/tenants/${tenantAId}`, 'get'],
      [`/super-admin/stats`, 'get'],
      [`/super-admin/utilisateurs`, 'get'],
      [`/super-admin/audit`, 'get'],
      [`/super-admin/plans`, 'get'],
      [`/super-admin/tenants/${tenantAId}/support/session`, 'get'],
      [`/super-admin/tenants/${tenantAId}/support/demarrer`, 'post'],
    ];

    for (const [route, method] of routes) {
      const agent = request(app.getHttpServer());
      const req = method === 'get' ? agent.get(route) : agent.post(route);
      const res = await req
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ motif: 'peu importe' });
      expect(res.status).toBe(403);
    }
  });

  it('liste et détail des tenants, mise à jour du plan', async () => {
    const list = await request(app.getHttpServer())
      .get('/super-admin/tenants')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(list.status).toBe(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(tenantAId);

    const detail = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(detail.status).toBe(200);
    expect(detail.body.licence.statut).toBe('ESSAI');
    expect(detail.body.proprietaire).toBe('admin@pressing-support.dev');
    expect(detail.body.nombreUtilisateurs).toBeGreaterThanOrEqual(1);

    const tenantDansLaListe = list.body.find((t: { id: string }) => t.id === tenantAId);
    expect(tenantDansLaListe.proprietaire).toBe('admin@pressing-support.dev');
    expect(tenantDansLaListe.nombreUtilisateurs).toBeGreaterThanOrEqual(1);

    const recherche = await request(app.getHttpServer())
      .get('/super-admin/tenants')
      .query({ q: tenantAId })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(recherche.status).toBe(200);
    expect(recherche.body).toEqual([]);

    const rechercheParSousDomaine = await request(app.getHttpServer())
      .get('/super-admin/tenants')
      .query({ q: sousDomaineA })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(rechercheParSousDomaine.status).toBe(200);
    expect(rechercheParSousDomaine.body.map((t: { id: string }) => t.id)).toEqual([tenantAId]);

    const filtreStatut = await request(app.getHttpServer())
      .get('/super-admin/tenants')
      .query({ statut: 'ESSAI' })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtreStatut.status).toBe(200);
    expect(filtreStatut.body.map((t: { id: string }) => t.id)).toContain(tenantAId);

    const updatePlan = await request(app.getHttpServer())
      .patch(`/super-admin/tenants/${tenantAId}/plan`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ plan: 'PRO' });
    expect(updatePlan.status).toBe(200);
    expect(updatePlan.body.plan).toBe('PRO');

    // §19.4 : un changement de configuration déclenché par le SUPER_ADMIN
    // est audité dans l'AuditLog du tenant concerné (018).
    const audit = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .query({ action: 'TENANT_PLAN_MODIFIE' });
    expect(audit.status).toBe(200);
    expect(audit.body).toHaveLength(1);
    expect(audit.body[0].metadata).toEqual({ nouveauPlan: 'PRO' });
  });

  it('catalogue de plans : non configuré par défaut, RBAC, mise à jour, compte de tenants réel', async () => {
    // PlanDefinition est un singleton par plan (config globale, pas une
    // entité par test) : on repart d'un état neutre pour que ce test reste
    // idempotent d'une exécution à l'autre.
    await prisma.planDefinition.deleteMany({ where: { plan: 'STARTER' } });

    const rbac = await request(app.getHttpServer())
      .put('/super-admin/plans/PRO')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ prixMensuel: 15000 });
    expect(rbac.status).toBe(403);

    const liste = await request(app.getHttpServer())
      .get('/super-admin/plans')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((p: { plan: string }) => p.plan).sort()).toEqual(
      ['BUSINESS', 'PRO', 'STARTER'].sort(),
    );
    const starterAvant = liste.body.find((p: { plan: string }) => p.plan === 'STARTER');
    expect(starterAvant.prixMensuel).toBeNull();
    expect(starterAvant.nombreTenants).toBeGreaterThanOrEqual(1);

    const maj = await request(app.getHttpServer())
      .put('/super-admin/plans/STARTER')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({
        prixMensuel: 5000,
        devise: 'XOF',
        limiteUtilisateurs: 3,
        limitePointsDeService: 1,
        fonctionnalites: ['Caisse', 'Tickets'],
      });
    expect(maj.status).toBe(200);
    expect(maj.body.prixMensuel).toBe(5000);
    expect(maj.body.limiteUtilisateurs).toBe(3);
    expect(maj.body.fonctionnalites).toEqual(['Caisse', 'Tickets']);

    const listeApres = await request(app.getHttpServer())
      .get('/super-admin/plans')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    const starterApres = listeApres.body.find((p: { plan: string }) => p.plan === 'STARTER');
    expect(starterApres.prixMensuel).toBe(5000);
  });

  it('vue globale des utilisateurs : lecture seule, filtrable par tenant', async () => {
    const tousLesTenants = await request(app.getHttpServer())
      .get('/super-admin/utilisateurs')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(tousLesTenants.status).toBe(200);
    expect(
      tousLesTenants.body.some(
        (u: { email: string; tenant: { id: string } }) =>
          u.email === 'admin@pressing-support.dev' && u.tenant.id === tenantAId,
      ),
    ).toBe(true);
    // Aucune fuite de compte SUPER_ADMIN (tenantId nul) dans la vue "tenants".
    expect(tousLesTenants.body.every((u: { tenant: unknown }) => u.tenant !== null)).toBe(true);

    const filtreParTenant = await request(app.getHttpServer())
      .get('/super-admin/utilisateurs')
      .query({ tenantId: tenantAId })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtreParTenant.status).toBe(200);
    expect(
      filtreParTenant.body.every((u: { tenant: { id: string } }) => u.tenant.id === tenantAId),
    ).toBe(true);
    expect(filtreParTenant.body.map((u: { email: string }) => u.email)).toContain(
      'admin@pressing-support.dev',
    );
  });

  it('statistiques globales', async () => {
    const res = await request(app.getHttpServer())
      .get('/super-admin/stats')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTenants).toBeGreaterThanOrEqual(1);
    expect(res.body.repartitionLicences.ESSAI).toBeGreaterThanOrEqual(1);
  });

  it('statistiques globales : revenu, plan, historique 12 mois, inscriptions et alertes reflètent les abonnements réels', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Facturation',
        sousDomaine: `sup-b-${suffix}`,
        email: 'admin@pressing-facturation.dev',
        motDePasse: 'super-secret-b1',
      });
    expect(registerB.status).toBe(201);
    const tenantBId: string = registerB.body.tenant.id;

    const abonnement = await prisma.abonnement.create({
      data: {
        tenantId: tenantBId,
        plan: 'PRO',
        modePaiement: 'MOBILE_MONEY',
        montant: 15000,
        devise: 'XOF',
        statut: 'ACTIF',
        dateProchaineFacturation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.journalPaiement.create({
      data: {
        tenantId: tenantBId,
        abonnementId: abonnement.id,
        type: 'PAIEMENT_REUSSI',
        montant: 15000,
        devise: 'XOF',
        idempotencyKey: `test-paiement-${suffix}`,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/super-admin/stats')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.revenuMensuel.devise).toBe('XOF');
    expect(res.body.revenuMensuel.montant).toBeGreaterThanOrEqual(15000);
    expect(res.body.nouveauxAbonnementsMois).toBeGreaterThanOrEqual(1);
    const planPro = res.body.revenuParPlan.find((entry: { plan: string }) => entry.plan === 'PRO');
    expect(planPro.montant).toBeGreaterThanOrEqual(15000);
    expect(res.body.evolutionRevenusMensuels).toHaveLength(12);
    const moisCourant = res.body.evolutionRevenusMensuels[11];
    expect(moisCourant.montant).toBeGreaterThanOrEqual(15000);
    expect(
      res.body.inscriptionsRecentes.some(
        (entry: { tenantId: string }) => entry.tenantId === tenantBId,
      ),
    ).toBe(true);
  });

  it('statistiques globales : alerte paiement en retard et licence expirant bientôt', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerC = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing En Retard',
        sousDomaine: `sup-c-${suffix}`,
        email: 'admin@pressing-retard.dev',
        motDePasse: 'super-secret-c1',
      });
    expect(registerC.status).toBe(201);
    const tenantCId: string = registerC.body.tenant.id;

    await prisma.abonnement.create({
      data: {
        tenantId: tenantCId,
        plan: 'STARTER',
        modePaiement: 'CARTE',
        montant: 5000,
        devise: 'XOF',
        statut: 'EN_RETARD',
        dateProchaineFacturation: new Date(),
      },
    });
    await prisma.licence.update({
      where: { tenantId: tenantCId },
      data: { dateFinEssai: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    });

    const res = await request(app.getHttpServer())
      .get('/super-admin/stats')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(res.status).toBe(200);
    expect(
      res.body.alertes.paiementsEnRetard.some(
        (entry: { tenantId: string }) => entry.tenantId === tenantCId,
      ),
    ).toBe(true);
    expect(
      res.body.alertes.licencesExpirantBientot.some(
        (entry: { tenantId: string }) => entry.tenantId === tenantCId,
      ),
    ).toBe(true);
  });

  it('mode support : aucun accès sans session, motif obligatoire, audit début/fin', async () => {
    // Aucune session active au départ.
    const sessionAvant = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}/support/session`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(sessionAvant.body.actif).toBe(false);

    // Accès aux données détaillées refusé sans session active.
    const auditSansSession = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}/support/audit`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(auditSansSession.status).toBe(403);

    // Motif obligatoire pour démarrer.
    const demarrerSansMotif = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/support/demarrer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({});
    expect(demarrerSansMotif.status).toBe(400);

    // Démarrage (audit de début).
    const demarrer = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/support/demarrer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motif: 'investigation ticket client #42' });
    expect(demarrer.status).toBe(201);
    expect(demarrer.body.motif).toBe('investigation ticket client #42');
    expect(demarrer.body.startedAt).toBeDefined();
    expect(demarrer.body.endedAt).toBeNull();

    // Une deuxième session concurrente est refusée.
    const demarrerDoublon = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/support/demarrer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motif: 'autre motif' });
    expect(demarrerDoublon.status).toBe(409);

    // Accès autorisé pendant la session active.
    const auditAvecSession = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}/support/audit`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(auditAvecSession.status).toBe(200);
    expect(Array.isArray(auditAvecSession.body)).toBe(true);

    const sessionPendant = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}/support/session`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(sessionPendant.body.actif).toBe(true);

    // Fin de session (audit de fin).
    const terminer = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/support/terminer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(terminer.status).toBe(201);
    expect(terminer.body.endedAt).not.toBeNull();

    // L'accès redevient impossible immédiatement après la fin de session.
    const auditApresFin = await request(app.getHttpServer())
      .get(`/super-admin/tenants/${tenantAId}/support/audit`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(auditApresFin.status).toBe(403);

    // §022-super-admin-enhancement : la session support (démarrée puis
    // terminée juste au-dessus) et les évènements de licence apparaissent
    // dans le flux plateforme, jamais l'AuditLog métier du tenant.
    const activerLicence = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/activer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID() });
    expect(activerLicence.status).toBe(201);

    const evenements = await request(app.getHttpServer())
      .get('/super-admin/audit')
      .query({ tenantId: tenantAId })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(evenements.status).toBe(200);
    expect(evenements.body.every((e: { tenantId: string }) => e.tenantId === tenantAId)).toBe(true);
    expect(
      evenements.body.some(
        (e: { type: string; action: string }) => e.type === 'LICENCE' && e.action === 'ACTIVATION',
      ),
    ).toBe(true);
    expect(
      evenements.body.some(
        (e: { type: string; action: string }) =>
          e.type === 'SUPPORT' && e.action === 'SESSION_SUPPORT_TERMINEE',
      ),
    ).toBe(true);

    const filtreType = await request(app.getHttpServer())
      .get('/super-admin/audit')
      .query({ tenantId: tenantAId, type: 'LICENCE' })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtreType.status).toBe(200);
    expect(filtreType.body.every((e: { type: string }) => e.type === 'LICENCE')).toBe(true);
  });
});
