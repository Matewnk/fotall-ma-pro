import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';

// Spec 006-onboarding — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : creation automatique a l'inscription, parcours normal en 3
// etapes, abandon a l'etape 2 puis reprise, non-regression d'etape,
// et que l'onboarding ne bloque jamais l'usage normal de l'API (aucune
// route hors /onboarding n'en depend).
describe('Onboarding (006) — PostgreSQL réel', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant() {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Onboarding',
        sousDomaine: `onb-${suffix}`,
        email: 'admin@pressing-onboarding.dev',
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken as string };
  }

  it('un état IDENTITE est créé automatiquement à l’inscription', async () => {
    const { token } = await registerTenant();

    const res = await request(app.getHttpServer())
      .get('/onboarding/etat')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.etapeCourante).toBe('IDENTITE');
    expect(res.body.identiteCompleteeAt).toBeNull();
  });

  it('abandon à l’étape 2 puis reprise : le parcours peut être terminé plus tard', async () => {
    const { token } = await registerTenant();
    const bearer = `Bearer ${token}`;

    const etape1 = await request(app.getHttpServer())
      .post('/onboarding/etape-1')
      .set('Authorization', bearer)
      .send({ adresse: '12 avenue du Pressing', telephone: '+221771234567' });
    expect(etape1.status).toBe(201);
    expect(etape1.body.etapeCourante).toBe('TARIFS');

    // Abandon simulé : le client relit juste l'état plus tard, sans agir.
    const etatAbandonne = await request(app.getHttpServer())
      .get('/onboarding/etat')
      .set('Authorization', bearer);
    expect(etatAbandonne.body.etapeCourante).toBe('TARIFS');
    expect(etatAbandonne.body.tarifsCompletesAt).toBeNull();

    // L'usage normal de l'API n'est jamais bloqué par un onboarding incomplet.
    const meAudit = await request(app.getHttpServer()).get('/audit').set('Authorization', bearer);
    expect(meAudit.status).toBe(200);

    // Reprise.
    const etape2 = await request(app.getHttpServer())
      .post('/onboarding/etape-2')
      .set('Authorization', bearer)
      .send({ choix: 'GRILLE_VIERGE' });
    expect(etape2.status).toBe(201);
    expect(etape2.body.etapeCourante).toBe('UTILISATEUR_NOTIFICATION');
    expect(etape2.body.choixCatalogue).toBe('GRILLE_VIERGE');

    const etape3 = await request(app.getHttpServer())
      .post('/onboarding/etape-3')
      .set('Authorization', bearer)
      .send({ canalPreference: 'PUSH' });
    expect(etape3.status).toBe(201);
    expect(etape3.body.etapeCourante).toBe('TERMINE');
    expect(etape3.body.termineAt).not.toBeNull();

    // Rappeler l'étape 1 après TERMINE corrige les données sans régresser l'étape.
    const correction = await request(app.getHttpServer())
      .post('/onboarding/etape-1')
      .set('Authorization', bearer)
      .send({ telephone: '+221770000000' });
    expect(correction.status).toBe(201);
    expect(correction.body.etapeCourante).toBe('TERMINE');
  });

  it('rejette une requête sans JWT', async () => {
    const res = await request(app.getHttpServer()).get('/onboarding/etat');
    expect(res.status).toBe(401);
  });
});
