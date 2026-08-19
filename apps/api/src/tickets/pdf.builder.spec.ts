import { buildPdfTicket } from './pdf.builder';
import { TicketData } from './ticket-data';

const dataDeBase: TicketData = {
  numero: 7,
  estProvisoire: false,
  nomPressing: 'Pressing Test',
  adresseTenant: null,
  telephoneTenant: null,
  client: { nom: 'Fatou Sy', telephone: '+221701112233' },
  articles: [{ intitule: 'Repassage', quantite: 1, tarifUnitaire: '500.00', sousTotal: '500.00' }],
  sousTotal: '500.00',
  remise: '0.00',
  total: '500.00',
  datePrevue: null,
  modeLivraison: 'RETRAIT',
  adresseLivraison: null,
  statut: 'EN_ATTENTE',
};

// Testable sans imprimante réelle (PROMPT 11) : on vérifie que le buffer
// produit est un PDF valide (signature %PDF), sans dépendre d'un moteur de
// rendu externe ni d'un périphérique.
describe('buildPdfTicket', () => {
  it('produit un buffer PDF valide (signature %PDF)', async () => {
    const buffer = await buildPdfTicket(dataDeBase);

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('fonctionne aussi pour une commande provisoire (offline)', async () => {
    const buffer = await buildPdfTicket({ ...dataDeBase, estProvisoire: true });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
