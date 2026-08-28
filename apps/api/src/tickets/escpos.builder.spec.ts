import { buildEscPosTicket } from './escpos.builder';
import { TicketData } from './ticket-data';

const dataDeBase: TicketData = {
  numero: 42,
  estProvisoire: false,
  nomPressing: 'Pressing Test',
  adresseTenant: '12 avenue du Pressing',
  telephoneTenant: '+221771234567',
  logoUrl: null,
  client: { nom: 'Awa Diop', telephone: '+221701234567' },
  articles: [
    { intitule: 'Lavage simple', quantite: 2, tarifUnitaire: '1000.00', sousTotal: '2000.00' },
  ],
  sousTotal: '2000.00',
  remise: '0.00',
  total: '2000.00',
  datePrevue: null,
  modeLivraison: 'RETRAIT',
  adresseLivraison: null,
  statut: 'EN_ATTENTE',
  modePaiement: null,
};

describe('buildEscPosTicket', () => {
  it('génère un payload qui débute par l’initialisation ESC/POS et se termine par la coupe papier', () => {
    const buffer = buildEscPosTicket(dataDeBase, 58);

    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    expect(buffer.subarray(buffer.length - 3)).toEqual(Buffer.from([0x1d, 0x56, 0x00]));
  });

  it('contient les informations essentielles de la commande (58mm et 80mm)', () => {
    for (const largeur of [58, 80] as const) {
      const texte = buildEscPosTicket(dataDeBase, largeur).toString('ascii');
      expect(texte).toContain('Commande #42');
      expect(texte).toContain('Awa Diop');
      expect(texte).toContain('TOTAL: 2000.00');
    }
  });

  it('affiche le mode de paiement quand la commande a été encaissée, jamais sinon', () => {
    const texteSansPaiement = buildEscPosTicket(dataDeBase, 58).toString('ascii');
    expect(texteSansPaiement).not.toContain('Paiement:');

    const texteAvecPaiement = buildEscPosTicket(
      { ...dataDeBase, modePaiement: 'WAVE' },
      58,
    ).toString('ascii');
    expect(texteAvecPaiement).toContain('Paiement: Wave');
  });

  it('marque clairement un numéro provisoire (offline)', () => {
    const texte = buildEscPosTicket({ ...dataDeBase, estProvisoire: true }, 58).toString('ascii');

    expect(texte).toContain('PROVISOIRE');
    expect(texte).toContain('Commande #42 (PROV.)');
  });

  it('ne marque rien pour une commande définitive', () => {
    const texte = buildEscPosTicket(dataDeBase, 58).toString('ascii');

    expect(texte).not.toContain('PROVISOIRE');
  });

  it('imprime le pied de page sous le QR code (même contenu que le PDF)', () => {
    const buffer = buildEscPosTicket(dataDeBase, 58);
    const texte = buffer.toString('ascii');

    expect(texte).toContain('Merci de votre confiance !');
    expect(texte).toContain('Fotall-Ma PRO');
    // GS ( k : commande native d'impression QR (modele 2), présente avant
    // le pied de page.
    const indexQr = buffer.indexOf(Buffer.from([0x1d, 0x28, 0x6b]));
    const indexPied = texte.indexOf('Merci de votre confiance');
    expect(indexQr).toBeGreaterThan(-1);
    expect(indexQr).toBeLessThan(indexPied);
    expect(buffer.includes(Buffer.from(`COMMANDE:${dataDeBase.numero}`, 'utf8'))).toBe(true);
  });
});
