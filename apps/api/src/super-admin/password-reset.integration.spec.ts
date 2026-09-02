import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Feature — SUPER-ADMIN : réinitialisation du mot de passe d'un ADMIN
// tenant. Preuve réelle contre PostgreSQL (pas de mock) : couvre le RBAC
// (401/403), l'isolation multi-tenant stricte (userId d'un autre tenant),
// l'audit sans donnée sensible, l'ancien mot de passe qui cesse de
// fonctionner, mustChangePassword forcé, la révocation de session
// (tokenVersion) et le flow self-service de changement obligatoire.
describe('Super-Admin — réinitialisation de mot de passe (PostgreSQL réel)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let adminAId: string;
  let emailAdminA: string;
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
    emailAdminA = `admin-${suffix}@pressing-reset.dev`;
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Reset',
        sousDomaine: `reset-a-${suffix}`,
        email: emailAdminA,
        motDePasse: 'ancien-mot-de-passe-1',
      });
    expect(registerA.status).toBe(201);
    tenantAId = registerA.body.tenant.id;
    adminAId = registerA.body.user.id;
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

  function route(tenantId: string, userId: string): string {
    return `/super-admin/tenants/${tenantId}/utilisateurs/${userId}/mot-de-passe`;
  }

  it('non authentifié → 401', async () => {
    const res = await request(app.getHttpServer())
      .patch(route(tenantAId, adminAId))
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
    expect(res.status).toBe(401);
  });

  it('ADMIN, CAISSIER, TECHNICIEN, LIVREUR → 403', async () => {
    const suffix = randomUUID().slice(0, 8);
    const jwt = new JwtService({ secret: jwtSecret });

    const roles = [Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR];
    for (const role of roles) {
      const user = await prisma.user.create({
        data: {
          tenantId: tenantAId,
          role,
          email: `${role.toLowerCase()}-${suffix}@pressing-reset.dev`,
          motDePasseHash: 'n/a',
        },
      });
      const token = jwt.sign({ sub: user.id, tenantId: tenantAId, role });

      const res = await request(app.getHttpServer())
        .patch(route(tenantAId, adminAId))
        .set('Authorization', `Bearer ${token}`)
        .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
      expect(res.status).toBe(403);
    }

    const resAdmin = await request(app.getHttpServer())
      .patch(route(tenantAId, adminAId))
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
    expect(resAdmin.status).toBe(403);
  });

  it('tenant inexistant → 404', async () => {
    const res = await request(app.getHttpServer())
      .patch(route(randomUUID(), adminAId))
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
    expect(res.status).toBe(404);
  });

  it('utilisateur inexistant → 404', async () => {
    const res = await request(app.getHttpServer())
      .patch(route(tenantAId, randomUUID()))
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
    expect(res.status).toBe(404);
  });

  it("utilisateur d'un AUTRE tenant → 404 (jamais une modification silencieuse)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Reset B',
        sousDomaine: `reset-b-${suffix}`,
        email: `admin-b-${suffix}@pressing-reset.dev`,
        motDePasse: 'mot-de-passe-b-1',
      });
    expect(registerB.status).toBe(201);
    const adminBId: string = registerB.body.user.id;
    const hashAvant = (await prisma.user.findUniqueOrThrow({ where: { id: adminBId } }))
      .motDePasseHash;

    // tenantA + userId de B : doit échouer, jamais toucher B.
    const res = await request(app.getHttpServer())
      .patch(route(tenantAId, adminBId))
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'nouveau-secret-123' });
    expect(res.status).toBe(404);

    const hashApres = (await prisma.user.findUniqueOrThrow({ where: { id: adminBId } }))
      .motDePasseHash;
    expect(hashApres).toBe(hashAvant);
  });

  it('mot de passe trop faible → 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(route(tenantAId, adminAId))
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motDePasse: 'court', confirmerMotDePasse: 'court' });
    expect(res.status).toBe(400);
  });

  it('confirmation différente → 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(route(tenantAId, adminAId))
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ motDePasse: 'nouveau-secret-123', confirmerMotDePasse: 'autre-chose-456' });
    expect(res.status).toBe(400);
  });

  it(
    'flow complet : reset SUPER_ADMIN → ancien mot de passe rejeté → nouveau mot de passe ' +
      'fonctionne avec mustChangePassword=true → session bloquée jusqu’au changement → ' +
      'ancienne session révoquée → audit sans donnée sensible',
    async () => {
      const reset = await request(app.getHttpServer())
        .patch(route(tenantAId, adminAId))
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({
          motDePasse: 'mot-de-passe-temporaire-1',
          confirmerMotDePasse: 'mot-de-passe-temporaire-1',
        });
      expect(reset.status).toBe(200);

      // Ancien mot de passe : ne fonctionne plus.
      const sousDomaineA = (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantAId } }))
        .sousDomaine;

      const loginAvecAncien = await request(app.getHttpServer()).post('/auth/login').send({
        sousDomaine: sousDomaineA,
        email: emailAdminA,
        motDePasse: 'ancien-mot-de-passe-1',
      });
      expect(loginAvecAncien.status).toBe(401);

      // Nouveau mot de passe temporaire : fonctionne, mustChangePassword=true.
      const loginAvecTemp = await request(app.getHttpServer()).post('/auth/login').send({
        sousDomaine: sousDomaineA,
        email: emailAdminA,
        motDePasse: 'mot-de-passe-temporaire-1',
      });
      expect(loginAvecTemp.status).toBe(201);
      expect(loginAvecTemp.body.user.mustChangePassword).toBe(true);
      const tokenTemp: string = loginAvecTemp.body.accessToken;

      // Ancienne session (token émis avant le reset) révoquée : tokenVersion périmé.
      const ancienneSession = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(ancienneSession.status).toBe(401);

      // Session bloquée tant que le changement n'est pas fait.
      const bloque = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenTemp}`);
      expect(bloque.status).toBe(403);

      // /auth/me et PATCH /auth/mot-de-passe restent accessibles.
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenTemp}`);
      expect(me.status).toBe(200);

      const changement = await request(app.getHttpServer())
        .patch('/auth/mot-de-passe')
        .set('Authorization', `Bearer ${tokenTemp}`)
        .send({
          motDePasseActuel: 'mot-de-passe-temporaire-1',
          motDePasseNouveau: 'mot-de-passe-final-1',
        });
      expect(changement.status).toBe(200);
      expect(changement.body.user.mustChangePassword).toBe(false);
      const tokenFinal: string = changement.body.accessToken;

      // Session débloquée avec le nouveau token.
      const debloque = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenFinal}`);
      expect(debloque.status).toBe(200);

      // Ancien token temporaire (pré-changement) révoqué lui aussi.
      const tempRevoque = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenTemp}`);
      expect(tempRevoque.status).toBe(401);

      // Audit : action journalisée, jamais de mot de passe/hash/token.
      const audit = await request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${tokenFinal}`)
        .query({ action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE' });
      expect(audit.status).toBe(200);
      expect(audit.body.length).toBeGreaterThanOrEqual(1);
      const texteAudit = JSON.stringify(audit.body);
      expect(texteAudit).not.toContain('mot-de-passe-temporaire-1');
      expect(texteAudit).not.toContain('mot-de-passe-final-1');
      expect(texteAudit).not.toContain('ancien-mot-de-passe-1');
    },
  );
});
