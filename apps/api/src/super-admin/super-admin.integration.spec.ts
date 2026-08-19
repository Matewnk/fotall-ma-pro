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
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Support',
        sousDomaine: `sup-a-${suffix}`,
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

    const updatePlan = await request(app.getHttpServer())
      .patch(`/super-admin/tenants/${tenantAId}/plan`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ plan: 'PRO' });
    expect(updatePlan.status).toBe(200);
    expect(updatePlan.body.plan).toBe('PRO');
  });

  it('statistiques globales', async () => {
    const res = await request(app.getHttpServer())
      .get('/super-admin/stats')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTenants).toBeGreaterThanOrEqual(1);
    expect(res.body.repartitionLicences.ESSAI).toBeGreaterThanOrEqual(1);
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
  });
});
