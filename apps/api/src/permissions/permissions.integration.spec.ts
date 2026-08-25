import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';

// 021-permissions-granulaires : endpoints ADMIN de gestion des overrides
// ALLOW/DENY. Preuve réelle contre PostgreSQL, isolation cross-tenant
// systématique (cf. specs/021-permissions-granulaires/spec.md).
describe('Permissions (021) — PostgreSQL réel', () => {
  let app: INestApplication;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let caissierAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Permissions A',
        sousDomaine: `perm-a-${suffix}`,
        email: 'admin@pressing-permissions-a.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Permissions B',
        sousDomaine: `perm-b-${suffix}`,
        email: 'admin@pressing-permissions-b.dev',
        motDePasse: 'super-secret-b1',
      });
    tokenAdminB = registerB.body.accessToken;

    const createCaissierA = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        email: `caissier-perm-${suffix}@pressing-permissions-a.dev`,
        motDePasse: 'super-secret-c1',
        role: 'CAISSIER',
      });
    caissierAId = createCaissierA.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET renvoie les permissions par défaut du rôle sans override', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(200);
    expect(res.body.effectives).toContain('commandes.encaisser');
    expect(res.body.effectives).not.toContain('reports.export');
    expect(res.body.overrides).toEqual([]);
  });

  it('PUT accorde un ALLOW hors défaut du rôle, GET le reflète', async () => {
    const put = await request(app.getHttpServer())
      .put(`/users/${caissierAId}/permissions/reports.export`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ effet: 'ALLOW' });
    expect(put.status).toBe(200);

    const get = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(get.body.effectives).toContain('reports.export');
    expect(get.body.overrides).toContainEqual({ permission: 'reports.export', effet: 'ALLOW' });
  });

  it('PUT DENY retire un droit présent par défaut dans le rôle', async () => {
    const put = await request(app.getHttpServer())
      .put(`/users/${caissierAId}/permissions/commandes.encaisser`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ effet: 'DENY' });
    expect(put.status).toBe(200);

    const get = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(get.body.effectives).not.toContain('commandes.encaisser');
  });

  it('DELETE supprime un override, le défaut du rôle reprend le dessus', async () => {
    const del = await request(app.getHttpServer())
      .delete(`/users/${caissierAId}/permissions/commandes.encaisser`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(del.status).toBe(200);

    const get = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(get.body.effectives).toContain('commandes.encaisser');
  });

  it('refuse toute permission inconnue (catalogue fermé)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${caissierAId}/permissions/services.hack-arbitraire`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ effet: 'ALLOW' });
    expect(res.status).toBe(400);
  });

  it('refuse un override sur users.manage / users.permissions (jamais configurables)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${caissierAId}/permissions/users.permissions`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ effet: 'ALLOW' });
    expect(res.status).toBe(403);
  });

  it('isolation cross-tenant : ADMIN B ne peut ni lire ni modifier les permissions d’un utilisateur de A', async () => {
    const get = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(get.status).toBe(404);

    const put = await request(app.getHttpServer())
      .put(`/users/${caissierAId}/permissions/reports.export`)
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ effet: 'ALLOW' });
    expect(put.status).toBe(404);

    const del = await request(app.getHttpServer())
      .delete(`/users/${caissierAId}/permissions/reports.export`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(del.status).toBe(404);
  });

  it('CAISSIER n’a pas accès à la gestion des permissions (403)', async () => {
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissierAId,
      tenantId: tenantAId,
      role: Role.CAISSIER,
    });

    const res = await request(app.getHttpServer())
      .get(`/users/${caissierAId}/permissions`)
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(res.status).toBe(403);
  });

  it('accès non authentifié refusé (401)', async () => {
    const res = await request(app.getHttpServer()).get(`/users/${caissierAId}/permissions`);
    expect(res.status).toBe(401);
  });
});
