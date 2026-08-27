import { TicketData } from './ticket-data';

// Encodeur ESC/POS minimal, ecrit a la main : aucune dependance a une
// librairie tierce ni a une imprimante reelle (testable en isolant le
// buffer produit, cf. tickets.service.spec.ts). 58mm/80mm different par le
// nombre de caracteres par ligne a la police par defaut (convention
// standard des imprimantes thermiques ESC/POS).
const ESC = 0x1b;
const GS = 0x1d;

export type LargeurTicketMm = 58 | 80;

const COLONNES_PAR_LARGEUR: Record<LargeurTicketMm, number> = { 58: 32, 80: 48 };

function centrer(texte: string, colonnes: number): string {
  if (texte.length >= colonnes) {
    return texte.slice(0, colonnes);
  }
  const marge = Math.floor((colonnes - texte.length) / 2);
  return ' '.repeat(marge) + texte;
}

function ligneSeparatrice(colonnes: number): string {
  return '-'.repeat(colonnes);
}

function commandeAlignement(centre: boolean): Buffer {
  return Buffer.from([ESC, 0x61, centre ? 1 : 0]); // ESC a n : alignement natif imprimante
}

// GS ( k : impression QR native (modele 2), meme contenu que le QR du PDF
// (pdf.builder.ts) — un seul format de donnees encode, quel que soit le
// support d'impression.
function commandeQrCode(contenu: string): Buffer {
  const data = Buffer.from(contenu, 'utf8');
  const longueurStockage = data.length + 3;
  const pL = longueurStockage & 0xff;
  const pH = (longueurStockage >> 8) & 0xff;
  return Buffer.concat([
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // modele 2
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]), // taille module 6
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // correction niveau M
    Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    data, // stockage des donnees
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), // impression
  ]);
}

export function buildEscPosTicket(data: TicketData, largeurMm: LargeurTicketMm): Buffer {
  const colonnes = COLONNES_PAR_LARGEUR[largeurMm];
  const lignes: string[] = [];

  if (data.estProvisoire) {
    lignes.push(centrer('** NUMERO PROVISOIRE **', colonnes));
  }
  lignes.push(centrer(data.nomPressing, colonnes));
  if (data.adresseTenant) {
    lignes.push(centrer(data.adresseTenant, colonnes));
  }
  if (data.telephoneTenant) {
    lignes.push(centrer(data.telephoneTenant, colonnes));
  }
  lignes.push(ligneSeparatrice(colonnes));
  lignes.push(`Commande #${data.numero}${data.estProvisoire ? ' (PROV.)' : ''}`);
  lignes.push(`Client: ${data.client.nom}`);
  lignes.push(`Tel: ${data.client.telephone}`);
  lignes.push(ligneSeparatrice(colonnes));
  for (const article of data.articles) {
    lignes.push(`${article.quantite} x ${article.intitule}`);
    lignes.push(`  ${article.tarifUnitaire} = ${article.sousTotal}`);
  }
  lignes.push(ligneSeparatrice(colonnes));
  lignes.push(`Sous-total: ${data.sousTotal}`);
  if (data.remise !== '0' && data.remise !== '0.00') {
    lignes.push(`Remise: -${data.remise}`);
  }
  lignes.push(`TOTAL: ${data.total}`);
  lignes.push(ligneSeparatrice(colonnes));
  lignes.push(`Mode: ${data.modeLivraison}`);
  if (data.adresseLivraison) {
    lignes.push(`Livraison: ${data.adresseLivraison}`);
  }
  if (data.datePrevue) {
    lignes.push(`Prevu le: ${data.datePrevue.toISOString().slice(0, 10)}`);
  }

  const corps = lignes.join('\n') + '\n\n';

  const pied =
    [centrer('Merci de votre confiance !', colonnes), centrer('Fotall-Ma PRO', colonnes)].join(
      '\n',
    ) + '\n\n\n';

  return Buffer.concat([
    Buffer.from([ESC, 0x40]), // ESC @ : initialisation
    Buffer.from(corps, 'ascii'),
    commandeAlignement(true),
    commandeQrCode(`FOTALL-MA:COMMANDE:${data.numero}`),
    Buffer.from('\n\n', 'ascii'),
    Buffer.from(pied, 'ascii'),
    commandeAlignement(false),
    Buffer.from([GS, 0x56, 0x00]), // GS V 0 : coupe papier totale
  ]);
}
