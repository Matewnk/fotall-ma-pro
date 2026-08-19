import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

// Compile le graphe de dependance complet (tous les modules, tous les
// providers) sans jamais se connecter a une base : .compile() n'appelle
// pas les hooks onModuleInit. Seul JWT_SECRET doit etre defini (lu au
// moment de construire JwtModule). Ce test aurait detecte immediatement
// le bug "Nest can't resolve dependencies of the LicenceService" (004)
// sans attendre le job CI avec Postgres.
describe('AppModule (graphe DI)', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'compile-check-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('résout tous les providers sans erreur', async () => {
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).resolves.toBeDefined();
  });
});
