import { buildDeliverySlipPdf } from './delivery-slip.builder';
import { TicketData } from './ticket-data';

const dataDeBase: TicketData = {
  numero: 12,
  estProvisoire: false,
  nomPressing: 'Pressing Test',
  adresseTenant: '12 avenue du Pressing',
  telephoneTenant: '+221771234567',
  logoUrl: null,
  client: { nom: 'Awa Diop', telephone: '+221701234567' },
  articles: [
    { intitule: 'Chemise sur cintre', quantite: 2, tarifUnitaire: '1000.00', sousTotal: '2000.00' },
    { intitule: 'Costume 2 pièces', quantite: 1, tarifUnitaire: '5000.00', sousTotal: '5000.00' },
  ],
  sousTotal: '7000.00',
  remise: '0.00',
  total: '7000.00',
  datePrevue: new Date('2026-08-25'),
  modeLivraison: 'LIVRAISON',
  adresseLivraison: '45 rue des Fleurs, Dakar',
  statut: 'PRET',
};

// Testable sans imprimante réelle, comme pdf.builder.spec.ts : on vérifie
// que le buffer produit est un PDF valide (signature %PDF).
describe('buildDeliverySlipPdf', () => {
  it('produit un buffer PDF valide (signature %PDF)', async () => {
    const buffer = await buildDeliverySlipPdf(dataDeBase);

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('fonctionne sans adresse de livraison ni date prévue (RETRAIT)', async () => {
    const buffer = await buildDeliverySlipPdf({
      ...dataDeBase,
      adresseLivraison: null,
      datePrevue: null,
    });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
