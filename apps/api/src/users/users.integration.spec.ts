import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 015-web (tranche 5) — nouveau backend requis pour l'écran
// "gestion des utilisateurs et rôles" : aucun n'existait jusqu'ici
// (auth.controller.ts n'expose que register/login/me). Preuve réelle
// contre PostgreSQL (pas de mock).
describe('Users (015-web tranche 5) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let adminAId: string;
  let tokenAdminB: string;

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
        nomPressing: 'Pressing Users A',
        sousDomaine: `usr-a-${suffix}`,
        email: 'admin@pressing-users-a.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;
    adminAId = registerA.body.user.id;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Users B',
        sousDomaine: `usr-b-${suffix}`,
        email: 'admin@pressing-users-b.dev',
        motDePasse: 'super-secret-b1',
      });
    tokenAdminB = registerB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('validation : rejette SUPER_ADMIN comme rôle assignable', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        email: 'x@pressing-users-a.dev',
        motDePasse: 'super-secret-x1',
        role: 'SUPER_ADMIN',
      });
    expect(res.status).toBe(400);
  });

  it('CRUD (création, liste, changement de rôle, désactivation), jamais le hash exposé', async () => {
    const create = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        email: 'caissier@pressing-users-a.dev',
        motDePasse: 'super-secret-c1',
        role: 'CAISSIER',
      });
    expect(create.status).toBe(201);
    expect(create.body).not.toHaveProperty('motDePasseHash');
    const userId = create.body.id;

    const list = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(list.status).toBe(200);
    expect(list.body.map((u: { id: string }) => u.id)).toContain(userId);
    expect(list.body.every((u: object) => !('motDePasseHash' in u))).toBe(true);

    const updateRole = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ role: 'TECHNICIEN' });
    expect(updateRole.status).toBe(200);
    expect(updateRole.body.role).toBe('TECHNICIEN');

    const deactivate = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ actif: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.actif).toBe(false);

    // Un compte désactivé ne peut plus se connecter.
    const loginBloque = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        sousDomaine: (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantAId } }))
          .sousDomaine,
        email: 'caissier@pressing-users-a.dev',
        motDePasse: 'super-secret-c1',
      });
    expect(loginBloque.status).toBe(401);
  });

  it('refuse qu’un ADMIN se désactive lui-même', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${adminAId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ actif: false });
    expect(res.status).toBe(400);
  });

  it('isolation cross-tenant : A ne peut ni voir ni modifier un utilisateur de B', async () => {
    const meB = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    const userBId = meB.body.userId;

    const list = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(list.body.map((u: { id: string }) => u.id)).not.toContain(userBId);

    const update = await request(app.getHttpServer())
      .patch(`/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ role: 'CAISSIER' });
    expect(update.status).toBe(404);
  });

  it('réinitialise le mot de passe d’un utilisateur géré, le nouveau mot de passe fonctionne', async () => {
    const create = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        email: `reset-cible-${randomUUID().slice(0, 8)}@pressing-users-a.dev`,
        motDePasse: 'ancien-secret-1',
        role: 'CAISSIER',
      });
    expect(create.status).toBe(201);
    const userId = create.body.id;
    const email = create.body.email;
    const sousDomaine = (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantAId } }))
      .sousDomaine;

    const reset = await request(app.getHttpServer())
      .patch(`/users/${userId}/mot-de-passe`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ motDePasse: 'nouveau-secret-1' });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ ok: true });

    const loginAncien = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ sousDomaine, email, motDePasse: 'ancien-secret-1' });
    expect(loginAncien.status).toBe(401);

    const loginNouveau = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ sousDomaine, email, motDePasse: 'nouveau-secret-1' });
    expect(loginNouveau.status).toBe(201);
  });

  it('un ADMIN peut réinitialiser son propre mot de passe', async () => {
    const suffix = randomUUID().slice(0, 8);
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Reset Self',
        sousDomaine: `usr-reset-${suffix}`,
        email: `admin-reset-${suffix}@pressing-reset.dev`,
        motDePasse: 'ancien-secret-2',
      });
    const tokenAdmin = register.body.accessToken;
    const adminId = register.body.user.id;
    const sousDomaine = register.body.tenant.sousDomaine;
    const email = register.body.user.email;

    const reset = await request(app.getHttpServer())
      .patch(`/users/${adminId}/mot-de-passe`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motDePasse: 'nouveau-secret-2' });
    expect(reset.status).toBe(200);

    const loginNouveau = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ sousDomaine, email, motDePasse: 'nouveau-secret-2' });
    expect(loginNouveau.status).toBe(201);
  });

  it('validation : mot de passe trop court refusé', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${adminAId}/mot-de-passe`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ motDePasse: 'court' });
    expect(res.status).toBe(400);
  });

  it('isolation cross-tenant : A ne peut pas réinitialiser le mot de passe d’un utilisateur de B', async () => {
    const meB = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    const userBId = meB.body.userId;

    const reset = await request(app.getHttpServer())
      .patch(`/users/${userBId}/mot-de-passe`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ motDePasse: 'nouveau-secret-3' });
    expect(reset.status).toBe(404);
  });

  it('RBAC : CAISSIER n’a pas accès à la gestion des utilisateurs', async () => {
    const caissier = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier-rbac-${randomUUID().slice(0, 8)}@pressing-users-a.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId: tenantAId,
      role: Role.CAISSIER,
    });

    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(res.status).toBe(403);
  });
});
