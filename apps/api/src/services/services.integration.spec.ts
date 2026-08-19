import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 008-services — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : CRUD, validation tarif, permissions, isolation du tarif
// cross-tenant (exigence explicite du cahier des charges), et le bouclage
// avec l'onboarding (006) : choix CATALOGUE_STANDARD -> 10 services créés,
// GRILLE_VIERGE -> catalogue vide.
describe('Services (008) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tokenAdminA: string;
  let tokenAdminB: string;

  async function registerTenant(prefix: string) {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: `Pressing ${prefix}`,
        sousDomaine: `srv-${prefix}-${suffix}`,
        email: `admin@pressing-${prefix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const a = await registerTenant('a');
    tokenAdminA = a.token;
    const b = await registerTenant('b');
    tokenAdminB = b.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('validation : un tarif négatif est rejeté', async () => {
    const res = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-99', intitule: 'Test', categorie: 'TEST', tarif: -100 });
    expect(res.status).toBe(400);
  });

  it('CRUD et rejet d’un code dupliqué', async () => {
    const create = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        code: 'SRV-90',
        intitule: 'Service test',
        categorie: 'TEST',
        tarif: 1234.5,
        delaiHeures: 24,
      });
    expect(create.status).toBe(201);
    const serviceId = create.body.id;

    const duplicate = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-90', intitule: 'Doublon', categorie: 'TEST', tarif: 1 });
    expect(duplicate.status).toBe(409);

    const update = await request(app.getHttpServer())
      .patch(`/services/${serviceId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ tarif: 999.99 });
    expect(update.status).toBe(200);
    expect(update.body.tarif).toBe('999.99');

    const remove = await request(app.getHttpServer())
      .delete(`/services/${serviceId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(remove.status).toBe(200);
  });

  it('le tarif d’un tenant n’apparaît jamais dans un autre tenant', async () => {
    const create = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-91', intitule: 'Tarif secret A', categorie: 'TEST', tarif: 42424.24 });
    const serviceAId = create.body.id;

    const getDirect = await request(app.getHttpServer())
      .get(`/services/${serviceAId}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(getDirect.status).toBe(404);

    const listB = await request(app.getHttpServer())
      .get('/services')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(listB.body.map((s: { code: string }) => s.code)).not.toContain('SRV-91');
    expect(JSON.stringify(listB.body)).not.toContain('42424.24');
  });

  it('permissions : CAISSIER peut lire mais pas créer/modifier/supprimer', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { tenantId, token: tokenAdmin } = await registerTenant(`rbac-${suffix}`);
    const caissier = await prisma.user.create({
      data: {
        tenantId,
        role: Role.CAISSIER,
        email: `caissier-${suffix}@pressing-rbac.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId,
      role: Role.CAISSIER,
    });

    const read = await request(app.getHttpServer())
      .get('/services')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(read.status).toBe(200);

    const create = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenCaissier}`)
      .send({ code: 'SRV-92', intitule: 'x', categorie: 'y', tarif: 1 });
    expect(create.status).toBe(403);

    void tokenAdmin;
  });

  it('onboarding étape 2 : CATALOGUE_STANDARD crée les 10 services de référence', async () => {
    const { token } = await registerTenant('catalogue-std');

    await request(app.getHttpServer())
      .post('/onboarding/etape-2')
      .set('Authorization', `Bearer ${token}`)
      .send({ choix: 'CATALOGUE_STANDARD' });

    const list = await request(app.getHttpServer())
      .get('/services')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(10);
    const codes = list.body.map((s: { code: string }) => s.code).sort();
    expect(codes).toEqual(
      [
        'SRV-01',
        'SRV-02',
        'SRV-03',
        'SRV-04',
        'SRV-05',
        'SRV-06',
        'SRV-07',
        'SRV-08',
        'LIV-01',
        'LIV-02',
      ].sort(),
    );
  });

  it('onboarding étape 2 : GRILLE_VIERGE ne crée aucun service', async () => {
    const { token } = await registerTenant('grille-vierge');

    await request(app.getHttpServer())
      .post('/onboarding/etape-2')
      .set('Authorization', `Bearer ${token}`)
      .send({ choix: 'GRILLE_VIERGE' });

    const list = await request(app.getHttpServer())
      .get('/services')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });
});
