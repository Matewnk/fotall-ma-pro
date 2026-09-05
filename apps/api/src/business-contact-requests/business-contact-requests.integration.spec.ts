import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Formulaire "Nous contacter" (carte plan Business) — preuve réelle contre
// PostgreSQL. Couvre : soumission publique sans authentification, DTO
// invalide (400), RBAC Super-Admin (401/403), 404, et la machine à états
// NOUVEAU -> EN_COURS -> TRAITE / NOUVEAU|EN_COURS -> REJETE.
describe('Business contact requests (PostgreSQL réel)', () => {
  let app: INestApplication;
  let jwtSecret: string;
  let tokenSuperAdmin: string;
  let tokenAdmin: string;

  const DTO_VALIDE = {
    nomComplet: 'Jean Dupont',
    entreprise: 'Pressing Lumière',
    email: 'jean.dupont@example.dev',
    telephone: '+221 77 000 00 00',
    typeActivite: 'PRESSING_BLANCHISSERIE',
    typeDemande: 'DEVIS',
    message: 'Nous avons 5 points de service à équiper de votre solution.',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-business-${suffix}@fotall.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenSuperAdmin = new JwtService({ secret: jwtSecret }).sign({
      sub: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
    });

    const registerAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Business Test',
        sousDomaine: `business-req-${suffix}`,
        email: `admin-${suffix}@business-req.dev`,
        motDePasse: 'super-secret-1',
      });
    expect(registerAdmin.status).toBe(201);
    tokenAdmin = registerAdmin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /demandes-business — public, sans authentification', () => {
    it('création valide → 201, statut initial NOUVEAU', async () => {
      const res = await request(app.getHttpServer()).post('/demandes-business').send(DTO_VALIDE);
      expect(res.status).toBe(201);
      expect(res.body.statut).toBe('NOUVEAU');
      expect(res.body.nomComplet).toBe('Jean Dupont');
    });

    it('activité Lavage auto → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, typeActivite: 'LAVAGE_AUTO' });
      expect(res.status).toBe(201);
      expect(res.body.typeActivite).toBe('LAVAGE_AUTO');
    });

    it('sans nom → 400', async () => {
      const sansNom: Record<string, unknown> = { ...DTO_VALIDE };
      delete sansNom.nomComplet;
      const res = await request(app.getHttpServer()).post('/demandes-business').send(sansNom);
      expect(res.status).toBe(400);
    });

    it('email invalide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, email: 'pas-un-email' });
      expect(res.status).toBe(400);
    });

    it('activité inexistante → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, typeActivite: 'NAUTIQUE' });
      expect(res.status).toBe(400);
    });

    it('type de demande inexistant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, typeDemande: 'AUTRE_CHOSE' });
      expect(res.status).toBe(400);
    });

    it('message trop court → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, message: 'court' });
      expect(res.status).toBe(400);
    });

    it('nombrePointsDeService < 1 → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, nombrePointsDeService: 0 });
      expect(res.status).toBe(400);
    });

    it('accepte une demande envoyée par un tenant connecté (tenantId informatif)', async () => {
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send({ ...DTO_VALIDE, tenantId: 'tenant-informatif-1', nombrePointsDeService: 3 });
      expect(res.status).toBe(201);
      expect(res.body.tenantId).toBe('tenant-informatif-1');
      expect(res.body.nombrePointsDeService).toBe(3);
    });

    it('accepte une demande du formulaire public sans entreprise (champ optionnel)', async () => {
      const sansEntreprise: Record<string, unknown> = { ...DTO_VALIDE };
      delete sansEntreprise.entreprise;
      const res = await request(app.getHttpServer())
        .post('/demandes-business')
        .send(sansEntreprise);
      expect(res.status).toBe(201);
      expect(res.body.entreprise).toBeNull();
    });
  });

  describe('Super-Admin — gestion des demandes', () => {
    it('non authentifié → 401', async () => {
      const res = await request(app.getHttpServer()).get('/super-admin/demandes-business');
      expect(res.status).toBe(401);
    });

    it('ADMIN tenant → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/super-admin/demandes-business')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(403);
    });

    it('SUPER_ADMIN peut lister et consulter le détail', async () => {
      const creation = await request(app.getHttpServer())
        .post('/demandes-business')
        .send(DTO_VALIDE);
      const id: string = creation.body.id;

      const liste = await request(app.getHttpServer())
        .get('/super-admin/demandes-business')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(liste.status).toBe(200);
      expect(liste.body.some((d: { id: string }) => d.id === id)).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/super-admin/demandes-business/${id}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(detail.status).toBe(200);
      expect(detail.body.id).toBe(id);
    });

    it('filtre par statut', async () => {
      const liste = await request(app.getHttpServer())
        .get('/super-admin/demandes-business')
        .query({ statut: 'NOUVEAU' })
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(liste.status).toBe(200);
      expect(liste.body.every((d: { statut: string }) => d.statut === 'NOUVEAU')).toBe(true);
    });

    it('demande inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/super-admin/demandes-business/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(404);
    });

    it('changement de statut inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${randomUUID()}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'EN_COURS' });
      expect(res.status).toBe(404);
    });

    it('machine à états : NOUVEAU -> EN_COURS -> TRAITE, jamais de saut ni de retour', async () => {
      const creation = await request(app.getHttpServer())
        .post('/demandes-business')
        .send(DTO_VALIDE);
      const id: string = creation.body.id;

      const sautEtape = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'TRAITE' });
      expect(sautEtape.status).toBe(400);

      const enCours = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'EN_COURS' });
      expect(enCours.status).toBe(200);
      expect(enCours.body.statut).toBe('EN_COURS');

      const traite = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'TRAITE' });
      expect(traite.status).toBe(200);
      expect(traite.body.statut).toBe('TRAITE');

      const retourArriere = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'EN_COURS' });
      expect(retourArriere.status).toBe(400);
    });

    it('machine à états : NOUVEAU -> REJETE autorisé, EN_COURS -> REJETE autorisé', async () => {
      const creation = await request(app.getHttpServer())
        .post('/demandes-business')
        .send(DTO_VALIDE);
      const id: string = creation.body.id;

      const rejet = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'REJETE' });
      expect(rejet.status).toBe(200);
      expect(rejet.body.statut).toBe('REJETE');

      const apresRejet = await request(app.getHttpServer())
        .patch(`/super-admin/demandes-business/${id}/statut`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ statut: 'EN_COURS' });
      expect(apresRejet.status).toBe(400);
    });
  });
});
