import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { libelleStatut } from './libelle-statut';
import { TicketData } from './ticket-data';

// Reçu thermique 80mm — maquette de référence :
// docs/design/screens/ticket_thermique_pur_pressing. Logo centré, sections
// séparées par un pointillé, montants alignés à droite, total en gras,
// pied de page dédicace.

function ligneDeuxColonnes(
  doc: PDFKit.PDFDocument,
  gauche: string,
  droite: string,
  options: { gras?: boolean; taille?: number } = {},
): void {
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font(options.gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.taille ?? 9);
  doc.text(gauche, marge, y, { width: largeur * 0.62, lineBreak: false });
  doc.text(droite, marge, y, { width: largeur, align: 'right', lineBreak: false });
  doc.moveDown(0.5);
}

function separateurPointille(doc: PDFKit.PDFDocument): void {
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y + 2;
  doc
    .moveTo(marge, y)
    .lineTo(marge + largeur, y)
    .dash(2, { space: 2 })
    .strokeColor('#000000')
    .stroke()
    .undash();
  doc.moveDown(0.8);
}

// Le logo tenant est servi par cette même API (uploads/logos, voir
// logo-storage.service.ts) : lu directement sur disque plutôt qu'en
// refaisant une requête HTTP vers soi-même.
function cheminLogoLocal(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  try {
    const chemin = new URL(logoUrl).pathname; // /uploads/logos/<fichier>
    if (!chemin.startsWith('/uploads/logos/')) return null;
    const fichier = join(process.cwd(), 'uploads', 'logos', chemin.replace('/uploads/logos/', ''));
    return existsSync(fichier) ? fichier : null;
  } catch {
    return null;
  }
}

export async function buildPdfTicket(data: TicketData): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(`FOTALL-MA:COMMANDE:${data.numero}`, {
    type: 'png',
    margin: 1,
    width: 120,
  });

  const doc = new PDFDocument({ size: [227, 550], margin: 12 }); // ~80mm de large
  const morceaux: Buffer[] = [];
  doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fin = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
  });

  if (data.estProvisoire) {
    doc.font('Helvetica-Bold').fontSize(10).text('** NUMÉRO PROVISOIRE **', { align: 'center' });
    doc.moveDown(0.3);
  }

  const logo = cheminLogoLocal(data.logoUrl);
  if (logo) {
    doc.image(logo, doc.page.width / 2 - 30, doc.y, { fit: [60, 60], align: 'center' });
    doc.moveDown(4.2);
  }

  doc.font('Helvetica-Bold').fontSize(14).text(data.nomPressing, { align: 'center' });
  doc.font('Helvetica').fontSize(8);
  if (data.adresseTenant) {
    doc.text(data.adresseTenant, { align: 'center' });
  }
  if (data.telephoneTenant) {
    doc.text(data.telephoneTenant, { align: 'center' });
  }
  doc.moveDown(0.5);
  separateurPointille(doc);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Commande #${data.numero}${data.estProvisoire ? ' (provisoire)' : ''}`);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).text(`Client : ${data.client.nom} — ${data.client.telephone}`);
  ligneDeuxColonnes(doc, 'Statut :', libelleStatut(data.statut), { gras: true });
  separateurPointille(doc);

  for (const article of data.articles) {
    ligneDeuxColonnes(doc, `${article.quantite} x ${article.intitule}`, article.sousTotal);
  }
  separateurPointille(doc);

  ligneDeuxColonnes(doc, 'Sous-total :', data.sousTotal);
  if (data.remise !== '0' && data.remise !== '0.00') {
    ligneDeuxColonnes(doc, 'Remise :', `-${data.remise}`);
  }
  ligneDeuxColonnes(doc, 'TOTAL :', `${data.total} FCFA`, { gras: true, taille: 12 });
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(9).text(`Mode : ${data.modeLivraison}`, { align: 'center' });
  doc.font('Helvetica').fontSize(9);
  if (data.adresseLivraison) {
    doc.text(`Livraison : ${data.adresseLivraison}`, { align: 'center' });
  }
  if (data.datePrevue) {
    doc.text(`Prévu le : ${data.datePrevue.toISOString().slice(0, 10)}`, { align: 'center' });
  }

  doc.moveDown(0.5);
  // doc.image() ne fait jamais avancer doc.y quand x/y sont fournis
  // explicitement (mode positionnement libre de PDFKit) : un moveDown()
  // approximatif après coup dépend de la taille de police alors active et
  // ne garantit pas de dégager les 100pt de hauteur du QR, d'où le texte
  // imprimé par-dessus l'image observé en test manuel. On avance donc
  // explicitement de la hauteur réelle de l'image, jamais d'une estimation.
  const TAILLE_QR = 100;
  const yQr = doc.y;
  doc.image(qrPng, doc.page.width / 2 - TAILLE_QR / 2, yQr, {
    fit: [TAILLE_QR, TAILLE_QR],
    align: 'center',
  });
  doc.y = yQr + TAILLE_QR + 8;

  doc.font('Helvetica-Bold').fontSize(9).text('Merci de votre confiance !', { align: 'center' });
  doc.font('Helvetica').fontSize(8).text('Fotall-Ma PRO', { align: 'center' });

  doc.end();
  return fin;
}
