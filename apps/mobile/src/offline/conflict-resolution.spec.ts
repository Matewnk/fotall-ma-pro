import {
  fusionnerClient,
  reconcilierIdentifiantCommande,
  resoudreConflitStatut,
} from './conflict-resolution';

describe('resoudreConflitStatut', () => {
  it('garde le statut local quand il est plus avancé (§18.3)', () => {
    expect(resoudreConflitStatut('PRET', 'EN_COURS')).toBe('PRET');
  });

  it('adopte le statut serveur quand il est plus avancé', () => {
    expect(resoudreConflitStatut('EN_ATTENTE', 'LIVRE')).toBe('LIVRE');
  });

  it('ne régresse jamais quand les deux statuts sont identiques', () => {
    expect(resoudreConflitStatut('EN_COURS', 'EN_COURS')).toBe('EN_COURS');
  });

  it('respecte l’ordre complet EN_ATTENTE < EN_COURS < PRET < LIVRE', () => {
    expect(resoudreConflitStatut('EN_ATTENTE', 'EN_COURS')).toBe('EN_COURS');
    expect(resoudreConflitStatut('EN_COURS', 'PRET')).toBe('PRET');
    expect(resoudreConflitStatut('PRET', 'LIVRE')).toBe('LIVRE');
  });
});

describe('fusionnerClient', () => {
  const local = { nom: 'Fatou Sy (corrigé)', telephone: '+221701112233', adresse: 'Dakar' };
  const horodatagesLocaux = {
    nom: new Date('2026-08-19T10:00:00Z'),
    telephone: new Date('2026-08-10T10:00:00Z'),
    adresse: new Date('2026-08-19T10:00:00Z'),
  };
  const serveur = { nom: 'Fatou Sy', telephone: '+221709998877', adresse: 'Dakar' };
  const horodatageServeur = new Date('2026-08-15T00:00:00Z');

  it('retient le champ local quand son horodatage est postérieur à la version serveur', () => {
    const fusion = fusionnerClient(local, horodatagesLocaux, serveur, horodatageServeur);
    expect(fusion.nom).toBe('Fatou Sy (corrigé)');
  });

  it('retient le champ serveur quand l’édition locale est plus ancienne', () => {
    const fusion = fusionnerClient(local, horodatagesLocaux, serveur, horodatageServeur);
    expect(fusion.telephone).toBe('+221709998877');
  });

  it('ne fusionne que champ par champ, jamais la ligne entière', () => {
    const fusion = fusionnerClient(local, horodatagesLocaux, serveur, horodatageServeur);
    expect(fusion).toEqual({
      nom: 'Fatou Sy (corrigé)', // local plus récent
      telephone: '+221709998877', // serveur plus récent
      adresse: 'Dakar', // identique des deux côtés
    });
  });

  it('retient la valeur serveur pour un champ jamais modifié localement', () => {
    const fusion = fusionnerClient(
      { nom: 'X', telephone: 'Y' },
      { nom: new Date(), telephone: new Date() },
      { nom: 'X', telephone: 'Y', email: 'contact@example.com' },
      new Date(),
    );
    expect(fusion.email).toBe('contact@example.com');
  });
});

describe('reconcilierIdentifiantCommande', () => {
  it('remplace l’identifiant local par l’identifiant et le numéro serveur, sans conflit métier (§18.3)', () => {
    const commandeLocale: { id?: string; statut: string } = { statut: 'EN_ATTENTE' };
    const reconciliee = reconcilierIdentifiantCommande(commandeLocale, {
      id: 'server-uuid-1',
      numero: 42,
    });
    expect(reconciliee).toEqual({ id: 'server-uuid-1', numero: 42, statut: 'EN_ATTENTE' });
  });
});
