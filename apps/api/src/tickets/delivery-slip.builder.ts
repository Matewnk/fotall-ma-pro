import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { TicketData } from './ticket-data';

// Bon de livraison — maquette de référence :
// docs/design/screens/bon_de_livraison_pressing. Même source de données
// que le reçu (TicketData) : zone/code porte/créneau horaire de la
// maquette n'ont pas de champ correspondant sur Commande, non repris.

function cheminLogoLocal(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  try {
    const chemin = new URL(logoUrl).pathname;
    if (!chemin.startsWith('/uploads/logos/')) return null;
    const fichier = join(process.cwd(), 'uploads', 'logos', chemin.replace('/uploads/logos/', ''));
    return existsSync(fichier) ? fichier : null;
  } catch {
    return null;
  }
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

function ligneDeuxColonnes(doc: PDFKit.PDFDocument, gauche: string, droite: string): void {
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font('Helvetica').fontSize(9);
  doc.text(gauche, marge, y, { width: largeur * 0.55, lineBreak: false });
  doc.text(droite, marge, y, { width: largeur, align: 'right', lineBreak: false });
  doc.moveDown(0.5);
}

export async function buildDeliverySlipPdf(data: TicketData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [227, 550], margin: 12 }); // ~80mm de large
  const morceaux: Buffer[] = [];
  doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fin = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
  });

  const logo = cheminLogoLocal(data.logoUrl);
  if (logo) {
    doc.image(logo, doc.page.width / 2 - 25, doc.y, { fit: [50, 50], align: 'center' });
    doc.moveDown(3.6);
  }

  doc.font('Helvetica-Bold').fontSize(13).text(data.nomPressing, { align: 'center' });
  doc.font('Helvetica').fontSize(8);
  if (data.adresseTenant) doc.text(data.adresseTenant, { align: 'center' });
  if (data.telephoneTenant) doc.text(data.telephoneTenant, { align: 'center' });
  doc.moveDown(0.5);
  separateurPointille(doc);

  doc.font('Helvetica-Bold').fontSize(11).text('BON DE LIVRAISON', { align: 'center' });
  doc.moveDown(0.4);
  ligneDeuxColonnes(doc, 'Commande :', `#${data.numero}`);
  if (data.datePrevue) {
    ligneDeuxColonnes(doc, 'Date prévue :', data.datePrevue.toISOString().slice(0, 10));
  }
  separateurPointille(doc);

  doc.font('Helvetica-Bold').fontSize(9).text('INFORMATIONS CLIENT');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).text(data.client.nom);
  doc.text(data.client.telephone);
  if (data.adresseLivraison) {
    doc.text(data.adresseLivraison);
  }
  doc.moveDown(0.3);
  separateurPointille(doc);

  doc.font('Helvetica-Bold').fontSize(9).text('ARTICLES LIVRÉS');
  doc.moveDown(0.3);
  let totalArticles = 0;
  for (const article of data.articles) {
    totalArticles += article.quantite;
    doc.font('Helvetica').fontSize(9).text(`${article.quantite}x ${article.intitule}`);
    doc.moveDown(0.2);
  }
  doc.moveDown(0.2);
  ligneDeuxColonnes(doc, 'Total articles :', String(totalArticles));
  separateurPointille(doc);

  doc.moveDown(1);
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const yLigne = doc.y + 24;
  doc
    .font('Helvetica')
    .fontSize(8)
    .text('Signature Client', marge, doc.y, { width: largeur / 2 - 6 });
  doc.fontSize(8).text('Signature Livreur', marge + largeur / 2 + 6, doc.y - 10, {
    width: largeur / 2 - 6,
    align: 'right',
  });
  doc
    .moveTo(marge, yLigne)
    .lineTo(marge + largeur / 2 - 6, yLigne)
    .strokeColor('#000000')
    .stroke();
  doc
    .moveTo(marge + largeur / 2 + 6, yLigne)
    .lineTo(marge + largeur, yLigne)
    .strokeColor('#000000')
    .stroke();
  doc.y = yLigne + 16;

  doc.font('Helvetica').fontSize(8).text('Merci pour votre confiance.', { align: 'center' });
  doc.text('Propulsé par Fotall-Ma PRO', { align: 'center' });

  doc.end();
  return fin;
}
