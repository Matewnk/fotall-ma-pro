import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec Stocks & Consommables — preuve réelle contre PostgreSQL (pas de
// mock). Couvre : CRUD article, mouvements (entrée/sortie/ajustement),
// dérivation de la quantité, garde-fou stock négatif, permissions,
// isolation cross-tenant.
describe('Stocks (Gestion des Stocks & Consommables) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenCaissierA: string;
  let tokenTechnicienA: string;

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
        nomPressing: 'Pressing Stock',
        sousDomaine: `stk-a-${suffix}`,
        email: 'admin@pressing-stock.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const jwt = new JwtService({ secret: jwtSecret });
    const caissier = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier-${suffix}@pressing-stock.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenCaissierA = jwt.sign({ sub: caissier.id, tenantId: tenantAId, role: Role.CAISSIER });

    const technicien = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.TECHNICIEN,
        email: `technicien-${suffix}@pressing-stock.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenTechnicienA = jwt.sign({
      sub: technicien.id,
      tenantId: tenantAId,
      role: Role.TECHNICIEN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('CRUD article + mouvements : la quantité dérivée reflète entrée/sortie/ajustement', async () => {
    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        code: 'DET-05L-PRO',
        intitule: 'Detergent Pro-Clean',
        unite: 'bidons (5L)',
        seuil: 10,
      });
    expect(create.status).toBe(201);
    const articleId = create.body.id;

    const entree = await request(app.getHttpServer())
      .post(`/stocks/articles/${articleId}/mouvements`)
      .set('Authorization', `Bearer ${tokenTechnicienA}`)
      .send({ type: 'ENTREE', quantite: 20, idempotencyKey: randomUUID() });
    expect(entree.status).toBe(201);

    const sortie = await request(app.getHttpServer())
      .post(`/stocks/articles/${articleId}/mouvements`)
      .set('Authorization', `Bearer ${tokenTechnicienA}`)
      .send({ type: 'SORTIE', quantite: 5, idempotencyKey: randomUUID() });
    expect(sortie.status).toBe(201);

    const ajustement = await request(app.getHttpServer())
      .post(`/stocks/articles/${articleId}/mouvements`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ type: 'AJUSTEMENT', quantite: 2, direction: 'BAISSE', idempotencyKey: randomUUID() });
    expect(ajustement.status).toBe(201);

    // 20 - 5 - 2 = 13, sous le seuil de 10 ? non -> pas en alerte.
    const lecture = await request(app.getHttpServer())
      .get(`/stocks/articles/${articleId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(lecture.body.quantite).toBe(13);
    expect(lecture.body.enAlerte).toBe(false);

    const update = await request(app.getHttpServer())
      .patch(`/stocks/articles/${articleId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ seuil: 20 });
    expect(update.status).toBe(200);

    const liste = await request(app.getHttpServer())
      .get('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    const articleDansListe = liste.body.find((a: { id: string }) => a.id === articleId);
    expect(articleDansListe.enAlerte).toBe(true); // 13 <= nouveau seuil 20

    const mouvements = await request(app.getHttpServer())
      .get('/stocks/articles/mouvements')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .query({ articleId });
    expect(mouvements.body).toHaveLength(3);
  });

  it('bloque la suppression d’un article ayant déjà des mouvements (historique jamais orphelin)', async () => {
    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'MVT-001', intitule: 'Article mouvementé', unite: 'unités' });
    const articleId = create.body.id;

    await request(app.getHttpServer())
      .post(`/stocks/articles/${articleId}/mouvements`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ type: 'ENTREE', quantite: 1, idempotencyKey: randomUUID() });

    const suppression = await request(app.getHttpServer())
      .delete(`/stocks/articles/${articleId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(suppression.status).toBe(409);
  });

  it('supprime un article jamais mouvementé', async () => {
    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'JAM-001', intitule: 'Article jamais utilisé', unite: 'unités' });

    const suppression = await request(app.getHttpServer())
      .delete(`/stocks/articles/${create.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(suppression.status).toBe(200);
  });

  it('refuse une sortie qui ferait passer le stock sous zéro', async () => {
    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'STN-RMV-01', intitule: 'Détachant', unite: 'flacons (1L)' });
    const articleId = create.body.id;

    const res = await request(app.getHttpServer())
      .post(`/stocks/articles/${articleId}/mouvements`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ type: 'SORTIE', quantite: 1, idempotencyKey: randomUUID() });
    expect(res.status).toBe(400);
  });

  it('rejette un code déjà utilisé (409)', async () => {
    await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'HNG-WIR-STD', intitule: 'Cintres', unite: 'unités' });

    const doublon = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'HNG-WIR-STD', intitule: 'Doublon', unite: 'unités' });
    expect(doublon.status).toBe(409);
  });

  it('permissions : CAISSIER peut lire mais pas créer d’article ni enregistrer de mouvement', async () => {
    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenCaissierA}`)
      .send({ code: 'PLY-RL-600', intitule: 'Gaines', unite: 'rouleaux' });
    expect(create.status).toBe(403);

    const lecture = await request(app.getHttpServer())
      .get('/stocks/articles')
      .set('Authorization', `Bearer ${tokenCaissierA}`);
    expect(lecture.status).toBe(200);

    const articleAdmin = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'PLY-RL-601', intitule: 'Gaines', unite: 'rouleaux' });

    const mouvement = await request(app.getHttpServer())
      .post(`/stocks/articles/${articleAdmin.body.id}/mouvements`)
      .set('Authorization', `Bearer ${tokenCaissierA}`)
      .send({ type: 'ENTREE', quantite: 1, idempotencyKey: randomUUID() });
    expect(mouvement.status).toBe(403);
  });

  it('isolation cross-tenant : un article de A est invisible depuis B', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Stock B',
        sousDomaine: `stk-b-${suffix}`,
        email: 'admin@pressing-stock-b.dev',
        motDePasse: 'super-secret-b1',
      });
    const tokenAdminB = registerB.body.accessToken;

    const create = await request(app.getHttpServer())
      .post('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'ISO-001', intitule: 'Article isolé', unite: 'unités' });

    const lectureB = await request(app.getHttpServer())
      .get(`/stocks/articles/${create.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(lectureB.status).toBe(404);

    const listeB = await request(app.getHttpServer())
      .get('/stocks/articles')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(listeB.body).toEqual([]);
  });
});
