import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';

// Spec 016-mobile-offline (tranche 5) — nouveau backend requis pour le
// portail client (§016-mobile-offline) : premier endpoint public de tout
// le projet (aucun JWT, aucun guard). Preuve réelle contre PostgreSQL
// (pas de mock) — isolation cross-tenant particulièrement critique ici
// puisqu'il n'y a pas de RolesGuard pour la garantir en profondeur.
describe('PublicTracking (016-mobile-offline tranche 5) — PostgreSQL réel', () => {
  let app: INestApplication;

  let sousDomaineA: string;
  let numeroA: number;
  let telephoneA: string;
  let sousDomaineB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const suffix = randomUUID().slice(0, 8);
    sousDomaineA = `suivi-a-${suffix}`;
    const registerA = await request(app.getHttpServer()).post('/auth/register').send({
      nomPressing: 'Pressing Suivi A',
      sousDomaine: sousDomaineA,
      email: 'admin@pressing-suivi-a.dev',
      motDePasse: 'super-secret-a1',
    });
    const tokenA = registerA.body.accessToken;

    telephoneA = '+221701112233';
    const clientA = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client Suivi A', telephone: telephoneA });

    const serviceA = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'SRV-01', intitule: 'Lavage', categorie: 'Vêtements', tarif: 1000 });

    const commandeA = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        clientId: clientA.body.id,
        articles: [{ serviceId: serviceA.body.id, quantite: 2 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    numeroA = commandeA.body.numero;

    sousDomaineB = `suivi-b-${suffix}`;
    await request(app.getHttpServer()).post('/auth/register').send({
      nomPressing: 'Pressing Suivi B',
      sousDomaine: sousDomaineB,
      email: 'admin@pressing-suivi-b.dev',
      motDePasse: 'super-secret-b1',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('aucune authentification requise : retourne le suivi avec sous-domaine + numéro + téléphone corrects', async () => {
    const res = await request(app.getHttpServer())
      .post('/suivi-commande')
      .send({ sousDomaine: sousDomaineA, numero: numeroA, telephone: telephoneA });
    expect(res.status).toBe(201);
    expect(res.body.numero).toBe(numeroA);
    expect(res.body.statut).toBe('EN_ATTENTE');
    expect(res.body.articles).toEqual([{ intitule: 'Lavage', quantite: 2, sousTotal: '2000.00' }]);
    expect(res.body.pressing.nomPressing).toBe('Pressing Suivi A');
  });

  it('404 générique (jamais de distinction) si le téléphone ne correspond pas', async () => {
    const res = await request(app.getHttpServer())
      .post('/suivi-commande')
      .send({ sousDomaine: sousDomaineA, numero: numeroA, telephone: '+221799999999' });
    expect(res.status).toBe(404);
  });

  it('404 si le numéro existe mais dans un autre tenant (isolation cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .post('/suivi-commande')
      .send({ sousDomaine: sousDomaineB, numero: numeroA, telephone: telephoneA });
    expect(res.status).toBe(404);
  });

  it('404 si le sous-domaine est inconnu', async () => {
    const res = await request(app.getHttpServer())
      .post('/suivi-commande')
      .send({ sousDomaine: 'sous-domaine-inexistant', numero: numeroA, telephone: telephoneA });
    expect(res.status).toBe(404);
  });

  it('validation : rejette un corps incomplet', async () => {
    const res = await request(app.getHttpServer())
      .post('/suivi-commande')
      .send({ sousDomaine: sousDomaineA });
    expect(res.status).toBe(400);
  });
});
