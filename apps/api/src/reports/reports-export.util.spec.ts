import { versCsv, versPdf } from './reports-export.util';
import { TableauRapport } from './reports.types';

const tableauDeBase: TableauRapport = {
  colonnes: ['Client', 'Total'],
  lignes: [
    ['Fatou Sy', '500'],
    ['Un client, "avec" virgule', '1 200'],
  ],
  resume: { totalCommandes: 2, chiffreAffaires: '1700' },
};

describe('versCsv', () => {
  it('produit un CSV avec en-têtes, lignes et résumé', () => {
    const csv = versCsv(tableauDeBase);
    const lignes = csv.trim().split('\n');

    expect(lignes[0]).toBe('Client,Total');
    expect(lignes[1]).toBe('Fatou Sy,500');
    expect(lignes).toContain('totalCommandes,2');
    expect(lignes).toContain('chiffreAffaires,1700');
  });

  it('échappe les valeurs contenant une virgule ou des guillemets', () => {
    const csv = versCsv(tableauDeBase);
    expect(csv).toContain('"Un client, ""avec"" virgule"');
  });

  it('fonctionne sans résumé', () => {
    const csv = versCsv({ colonnes: ['A'], lignes: [['x']] });
    expect(csv).toBe('A\nx\n');
  });
});

describe('versPdf', () => {
  it('produit un buffer PDF valide (signature %PDF)', async () => {
    const buffer = await versPdf('Rapport de test', tableauDeBase);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(200);
  });

  it('fonctionne pour un tableau vide', async () => {
    const buffer = await versPdf('Vide', { colonnes: ['A'], lignes: [] });
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
