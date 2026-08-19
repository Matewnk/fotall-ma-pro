import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TenantPrismaFactory } from './tenant-prisma.factory';
import { TenantSchemaProvisioner } from './tenant-schema.provisioner';

// RELEASE BLOCKER (003-tenant-isolation) — preuve reelle contre PostgreSQL,
// pas de mock, conformement a la Constitution ("aucun contournement de
// test"). Necessite DATABASE_URL + JWT_SECRET vers une vraie instance
// (voir jest.integration.config.js et le job CI dedie).
//
// Perimetre couvert ici : isolation physique par schema PostgreSQL dedie
// (GET/LIST/SEARCH/UPDATE/DELETE, tenant_id/JWT falsifie, ID direct).
// Hors perimetre, reporte aux specs qui introduisent ces sous-systemes :
// cache (aucun Redis branche), queue (aucune queue implementee),
// fichiers (aucun stockage implemente), API keys (spec 019), exports/
// rapports (specs 014+).
describe('Tenant isolation (RELEASE BLOCKER) — PostgreSQL réel', () => {
  let app: INestApplication;
  let tenantPrisma: TenantPrismaFactory;
  let provisioner: TenantSchemaProvisioner;
  let jwtSecret: string;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let tokenA: string;
  let tokenB: string;
  let auditAId: string;
  let auditBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    tenantPrisma = moduleRef.get(TenantPrismaFactory);
    provisioner = moduleRef.get(TenantSchemaProvisioner);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);

    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing A',
        sousDomaine: `iso-a-${suffix}`,
        email: 'admin@pressing-a.dev',
        motDePasse: 'super-secret-a1',
      });
    expect(registerA.status).toBe(201);
    tenantAId = registerA.body.tenant.id;
    userAId = registerA.body.user.id;
    tokenA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing B',
        sousDomaine: `iso-b-${suffix}`,
        email: 'admin@pressing-b.dev',
        motDePasse: 'super-secret-b1',
      });
    expect(registerB.status).toBe(201);
    tenantBId = registerB.body.tenant.id;
    tokenB = registerB.body.accessToken;

    const auditA = await request(app.getHttpServer())
      .post('/audit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'TEST_A', entityType: 'test', entityId: 'x' });
    expect(auditA.status).toBe(201);
    auditAId = auditA.body.id;

    const auditB = await request(app.getHttpServer())
      .post('/audit')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ action: 'TEST_B', entityType: 'test', entityId: 'y' });
    expect(auditB.status).toBe(201);
    auditBId = auditB.body.id;
  });

  afterAll(async () => {
    await provisioner.drop(tenantAId).catch(() => undefined);
    await provisioner.drop(tenantBId).catch(() => undefined);
    await app.close();
  });

  it('GET direct par ID : A ne peut pas lire une ressource de B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit/${auditBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('LIST : A ne voit jamais les entrées de B', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.map((entry: { id: string }) => entry.id)).toContain(auditAId);
    expect(res.body.map((entry: { id: string }) => entry.id)).not.toContain(auditBId);
  });

  it('SEARCH (filtre action) : scope toujours limité au tenant courant', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit')
      .query({ action: 'TEST_B' })
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST : un tenant_id fourni par le client dans le corps est rejeté (whitelist DTO)', async () => {
    const res = await request(app.getHttpServer())
      .post('/audit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'TEST_A', entityType: 'test', entityId: 'z', tenantId: tenantBId });
    expect(res.status).toBe(400);
  });

  it('UPDATE direct : impossible physiquement de modifier une ligne du schéma de B depuis A', async () => {
    await expect(
      tenantPrisma.forTenant(tenantAId).auditLog.update({
        where: { id: auditBId },
        data: { action: 'HACKED' },
      }),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('DELETE direct : impossible physiquement de supprimer une ligne du schéma de B depuis A', async () => {
    await expect(
      tenantPrisma.forTenant(tenantAId).auditLog.delete({ where: { id: auditBId } }),
    ).rejects.toMatchObject({ code: 'P2025' });

    const stillThere = await tenantPrisma
      .forTenant(tenantBId)
      .auditLog.findUnique({ where: { id: auditBId } });
    expect(stillThere).not.toBeNull();
  });

  it('rejette un JWT dont le tenant_id ne correspond plus à l’utilisateur en base (tenant falsifié)', async () => {
    const forgedJwt = new JwtService({ secret: jwtSecret });
    const forgedToken = forgedJwt.sign({ sub: userAId, tenantId: tenantBId, role: Role.ADMIN });

    const res = await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });

  it('rejette une requête sans JWT', async () => {
    const res = await request(app.getHttpServer()).get('/audit');
    expect(res.status).toBe(401);
  });
});
