import { analyserDatabaseUrl } from './database-url';

describe('analyserDatabaseUrl', () => {
  it('extrait host/port/utilisateur/mot de passe/base', () => {
    const resultat = analyserDatabaseUrl('postgresql://fotall:change-me@localhost:5432/fotall');
    expect(resultat).toEqual({
      host: 'localhost',
      port: '5432',
      utilisateur: 'fotall',
      motDePasse: 'change-me',
      base: 'fotall',
    });
  });

  it('retombe sur le port 5432 par défaut si absent', () => {
    const resultat = analyserDatabaseUrl('postgresql://fotall:change-me@localhost/fotall');
    expect(resultat.port).toBe('5432');
  });

  it('décode les caractères spéciaux du mot de passe', () => {
    const resultat = analyserDatabaseUrl('postgresql://fotall:p%40ss%3Aw0rd@localhost:5432/fotall');
    expect(resultat.motDePasse).toBe('p@ss:w0rd');
  });
});
