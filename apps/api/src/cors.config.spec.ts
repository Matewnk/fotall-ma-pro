import { resoudreOriginsCors } from './cors.config';

describe('resoudreOriginsCors', () => {
  it('accepte toute origine en dehors de la production (dev local)', () => {
    expect(resoudreOriginsCors('development', undefined)).toBe(true);
  });

  it('bloque tout en production si CORS_ORIGINS n’est pas configuré (échec visible plutôt qu’un trou silencieux)', () => {
    expect(resoudreOriginsCors('production', undefined)).toBe(false);
    expect(resoudreOriginsCors('production', '')).toBe(false);
  });

  it('n’accepte que les origines listées en production', () => {
    expect(resoudreOriginsCors('production', 'https://app.fotall-ma.pro')).toEqual([
      'https://app.fotall-ma.pro',
    ]);
  });

  it('accepte plusieurs origines séparées par des virgules, espaces tolérés', () => {
    expect(
      resoudreOriginsCors('production', 'https://app.fotall-ma.pro, https://admin.fotall-ma.pro'),
    ).toEqual(['https://app.fotall-ma.pro', 'https://admin.fotall-ma.pro']);
  });
});
