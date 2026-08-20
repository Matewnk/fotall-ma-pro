import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';

// superagent ne bufferise pas automatiquement les content-types binaires
// inconnus (application/sql) : on force un parseur brut, comme dans
// tickets.integration.spec.ts (011) et reports.integration.spec.ts (014).
function bufferise(req: request.Test): request.Test {
  return req.buffer(true).parse((res, callback) => {
    const morceaux: Buffer[] = [];
    res.on('data', (morceau: Buffer) => morceaux.push(morceau));
    res.on('end', () => callback(null, Buffer.concat(morceaux)));
  });
}

// Spec 020-production — preuve reelle contre PostgreSQL (pas de mock),
// pg_dump/psql reels (deja presents sur les runners GitHub Actions
// ubuntu-latest). Couvre : sauvegarde/restauration tenant par tenant
// (§15.8), round-trip complet (corruption puis restauration), audit,
// RBAC, isolation (le dump d'un tenant ne contient jamais un autre).
describe('Backup/Restore (020) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantPrisma: TenantPrismaFactory;
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
    tenantPrisma = moduleRef.get(TenantPrismaFactory);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-backup-${suffix}@fotall.dev`,
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
        sousDomaine: `backup-${prefix}-${suffix}`,
        email: `admin@backup-${prefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  it('round-trip complet : sauvegarde, corruption, restauration, données retrouvées', async () => {
    const { tenantId, token } = await registerTenant('roundtrip');
    const bearer = `Bearer ${token}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearer)
      .send({ nom: 'ClientAvantSauvegarde', telephone: '+221701112233' });
    expect(client.status).toBe(201);

    const sauvegarde = await bufferise(
      request(app.getHttpServer())
        .post(`/super-admin/tenants/${tenantId}/backup`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`),
    );
    expect(sauvegarde.status).toBe(201);
    const dump = sauvegarde.body as Buffer;
    expect(dump.length).toBeGreaterThan(0);
    expect(dump.toString('utf-8')).toContain('ClientAvantSauvegarde');

    // "Corruption" : le client est supprimé directement en base, comme un
    // incident réel de perte de données.
    await tenantPrisma.forTenant(tenantId).client.delete({ where: { id: client.body.id } });
    const apresCorruption = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', bearer);
    expect(apresCorruption.body).toHaveLength(0);

    const restauration = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/restore`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ confirmation: 'CONFIRMER_RESTAURATION', dumpBase64: dump.toString('base64') });
    expect(restauration.status).toBe(201);

    const apresRestauration = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', bearer);
    expect(apresRestauration.status).toBe(200);
    expect(apresRestauration.body.map((c: { nom: string }) => c.nom)).toContain(
      'ClientAvantSauvegarde',
    );

    const audit = await request(app.getHttpServer()).get('/audit').set('Authorization', bearer);
    const actions = audit.body.map((entree: { action: string }) => entree.action);
    expect(actions).toEqual(expect.arrayContaining(['TENANT_SAUVEGARDE', 'TENANT_RESTAURE']));
  });

  it('rejette une restauration sans la confirmation exacte', async () => {
    const { tenantId } = await registerTenant('confirmation');

    const res = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/restore`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ confirmation: 'oui', dumpBase64: Buffer.from('SELECT 1;').toString('base64') });
    expect(res.status).toBe(400);
  });

  it('RBAC : ADMIN ne peut ni sauvegarder ni restaurer', async () => {
    const { tenantId, token } = await registerTenant('rbac');

    const sauvegarde = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/backup`)
      .set('Authorization', `Bearer ${token}`);
    expect(sauvegarde.status).toBe(403);

    const restauration = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'CONFIRMER_RESTAURATION', dumpBase64: 'ignore' });
    expect(restauration.status).toBe(403);
  });

  it('isolation : la sauvegarde de A ne contient jamais une donnée de B', async () => {
    const { tenantId: tenantAId, token: tokenA } = await registerTenant('iso-a');
    const { token: tokenB } = await registerTenant('iso-b');

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'ClientUniqueTenantA', telephone: '+221701110001' });
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nom: 'ClientUniqueTenantB', telephone: '+221701110002' });

    const sauvegardeA = await bufferise(
      request(app.getHttpServer())
        .post(`/super-admin/tenants/${tenantAId}/backup`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`),
    );
    expect(sauvegardeA.status).toBe(201);
    const texte = (sauvegardeA.body as Buffer).toString('utf-8');
    expect(texte).toContain('ClientUniqueTenantA');
    expect(texte).not.toContain('ClientUniqueTenantB');
  });
});
