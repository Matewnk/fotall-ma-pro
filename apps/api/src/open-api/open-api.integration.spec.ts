import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 019-open-api — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : cycle de vie d'une clé API (création/liste/révocation, §17),
// authentification par clé sur la surface /api/v1/*, scopes, quota
// journalier, RBAC (ADMIN uniquement), isolation cross-tenant, et un
// test de fumée sur la documentation OpenAPI générée.
describe('Open API (019) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    // main.ts n'est jamais exécuté par le harnais de test (l'app est
    // construite directement depuis AppModule) : le montage de Swagger
    // doit être reproduit ici pour que le test de fumée sur /docs porte
    // sur le même code que la production.
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    SwaggerModule.setup('docs', app, document);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');
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
        sousDomaine: `oapi-${prefix}-${suffix}`,
        email: `admin@oapi-${prefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  it('cycle de vie complet : création, utilisation, révocation', async () => {
    const { token } = await registerTenant('cycle');
    const bearer = `Bearer ${token}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearer)
      .send({ nom: 'Client Open API', telephone: '+221701112233' });
    expect(client.status).toBe(201);

    const creation = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', bearer)
      .send({ nom: 'Intégration test', scopes: ['clients:read'] });
    expect(creation.status).toBe(201);
    expect(creation.body.cle).toMatch(/^fmp_live_/);
    const cleClaire = creation.body.cle as string;

    const liste = await request(app.getHttpServer()).get('/api-keys').set('Authorization', bearer);
    expect(liste.status).toBe(200);
    expect(liste.body).toHaveLength(1);
    expect(liste.body[0].cle).toBeUndefined();
    expect(liste.body[0].clePrefixe).toBe(cleClaire.slice(0, liste.body[0].clePrefixe.length));

    const lectureClients = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', cleClaire);
    expect(lectureClients.status).toBe(200);
    expect(lectureClients.body.map((c: { nom: string }) => c.nom)).toContain('Client Open API');

    const revocation = await request(app.getHttpServer())
      .delete(`/api-keys/${creation.body.id}`)
      .set('Authorization', bearer);
    expect(revocation.status).toBe(200);

    const apresRevocation = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', cleClaire);
    expect(apresRevocation.status).toBe(403);
  });

  it('scopes : une clé sans le scope requis est refusée sur la ressource correspondante', async () => {
    const { token } = await registerTenant('scopes');
    const bearer = `Bearer ${token}`;

    const creation = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', bearer)
      .send({ nom: 'Clients seulement', scopes: ['clients:read'] });
    const cleClaire = creation.body.cle as string;

    const clients = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', cleClaire);
    expect(clients.status).toBe(200);

    const commandes = await request(app.getHttpServer())
      .get('/api/v1/commandes')
      .set('X-Api-Key', cleClaire);
    expect(commandes.status).toBe(403);
  });

  it('refuse une requête sans en-tête X-Api-Key ou avec une clé inconnue', async () => {
    const sansCle = await request(app.getHttpServer()).get('/api/v1/clients');
    expect(sansCle.status).toBe(403);

    const cleInconnue = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', 'fmp_live_inconnue');
    expect(cleInconnue.status).toBe(403);
  });

  it('quota journalier : la clé est refusée une fois la limite atteinte', async () => {
    const { token } = await registerTenant('quota');
    const bearer = `Bearer ${token}`;

    const creation = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', bearer)
      .send({ nom: 'Quota bas', scopes: ['clients:read'], quotaJour: 1 });
    const cleClaire = creation.body.cle as string;

    const premiere = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', cleClaire);
    expect(premiere.status).toBe(200);

    const deuxieme = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('X-Api-Key', cleClaire);
    expect(deuxieme.status).toBe(403);
  });

  it('RBAC : seul ADMIN peut gérer les clés API', async () => {
    const nonAuthentifie = await request(app.getHttpServer()).post('/api-keys');
    expect(nonAuthentifie.status).toBe(401);

    const { tenantId } = await registerTenant('rbac');
    const suffix = randomUUID().slice(0, 8);
    const caissier = await prisma.user.create({
      data: {
        tenantId,
        role: Role.CAISSIER,
        email: `caissier-${suffix}@oapi-rbac.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId,
      role: Role.CAISSIER,
    });

    const refuse = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', `Bearer ${tokenCaissier}`)
      .send({ nom: 'X', scopes: ['clients:read'] });
    expect(refuse.status).toBe(403);
  });

  it('isolation cross-tenant : la clé de A ne retourne jamais les données de B', async () => {
    const { token: tokenA } = await registerTenant('iso-a');
    const { token: tokenB } = await registerTenant('iso-b');

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'ClientUniqueA', telephone: '+221701110001' });
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nom: 'ClientUniqueB', telephone: '+221701110002' });

    const creationA = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Clé A', scopes: ['clients:read'] });
    const cleA = creationA.body.cle as string;

    const res = await request(app.getHttpServer()).get('/api/v1/clients').set('X-Api-Key', cleA);
    expect(res.status).toBe(200);
    const noms = res.body.map((c: { nom: string }) => c.nom);
    expect(noms).toContain('ClientUniqueA');
    expect(noms).not.toContain('ClientUniqueB');
  });

  it('documentation OpenAPI accessible', async () => {
    const res = await request(app.getHttpServer()).get('/docs');
    expect(res.status).toBe(200);
  });
});
