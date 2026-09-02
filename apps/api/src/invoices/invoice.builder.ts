import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { InvoiceData } from './invoice-data';

// Facture — format A4 professionnel (Phase 4 de la mission
// 023-subscriptions-invoicing). Réutilise le style déjà en place dans
// apps/api/src/tickets/*.builder.ts (logo, séparateurs, montants alignés)
// plutôt que d'introduire une seconde bibliothèque PDF. AUCUNE ligne TVA/
// taxe : aucun régime fiscal n'existe dans le projet (voir spec.md) — un
// seul total est affiché.

const LIBELLES_MODE: Record<string, string> = {
  CARTE: 'Carte bancaire',
  MOBILE_MONEY: 'Mobile Money',
  VIREMENT: 'Virement',
};

const LIBELLES_STATUT: Record<string, string> = {
  EMISE: 'Émise',
  PAYEE: 'Payée',
  EN_RETARD: 'En retard',
  ANNULEE: 'Annulée',
};

const LIBELLES_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formaterDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formaterPeriode(debut: Date, fin: Date): string {
  return `${LIBELLES_MOIS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
}

function formaterMontant(montant: number, devise: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} ${devise}`;
}

// Dérivée de la période — jamais un champ séparé à maintenir en double
// (voir invoices.service.ts#creerPourRenouvellementTenant, qui construit
// déjà periodeDebut/periodeFin à partir de la durée choisie).
function calculerDureeMois(debut: Date, fin: Date): number {
  const jours = Math.round((fin.getTime() - debut.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.round(jours / 30));
}

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

function ligneDeuxColonnes(
  doc: PDFKit.PDFDocument,
  gauche: string,
  droite: string,
  options: { gras?: boolean; taille?: number } = {},
): void {
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font(options.gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.taille ?? 10);
  doc.text(gauche, marge, y, { width: largeur * 0.6, lineBreak: false });
  doc.text(droite, marge, y, { width: largeur, align: 'right', lineBreak: false });
  doc.moveDown(0.6);
}

function traitHorizontal(doc: PDFKit.PDFDocument): void {
  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .moveTo(marge, doc.y)
    .lineTo(marge + largeur, doc.y)
    .strokeColor('#dbe6ef')
    .stroke();
  doc.moveDown(0.8);
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const morceaux: Buffer[] = [];
  doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fin = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
  });

  const marge = doc.page.margins.left;
  const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const logo = cheminLogoLocal(data.logoUrl);
  if (logo) {
    doc.image(logo, marge, doc.y, { fit: [48, 48] });
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#003c90')
    .text('FOTALL-MA PRO', marge + (logo ? 60 : 0), doc.y, { continued: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5b73')
    .text('Gestion professionnelle de pressing — SaaS multi-tenant', marge + (logo ? 60 : 0));
  doc.fillColor('#0b1f3a');
  doc.moveDown(1.2);

  doc.font('Helvetica-Bold').fontSize(14).text('FACTURE');
  doc.moveDown(0.3);
  ligneDeuxColonnes(doc, `N° ${data.numero}`, `Émise le ${formaterDate(data.dateEmission)}`);
  ligneDeuxColonnes(doc, '', `Échéance : ${formaterDate(data.dateEcheance)}`);
  doc.moveDown(0.4);
  traitHorizontal(doc);

  doc.font('Helvetica-Bold').fontSize(10).text('FACTURÉ À');
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11).text(data.nomPressing);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Identifiant tenant : ${data.sousDomaine}`);
  doc.text(`Propriétaire : ${data.emailProprietaire ?? 'Non disponible'}`);
  doc.text(`Adresse : ${data.adresseTenant ?? 'Non disponible'}`);
  doc.text(`Téléphone : ${data.telephoneTenant ?? 'Non disponible'}`);
  doc.moveDown(0.6);
  traitHorizontal(doc);

  doc.moveDown(0.3);
  const yEntete = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#4b5b73');
  doc.text('DESCRIPTION', marge, yEntete, { width: largeur * 0.5, lineBreak: false });
  doc.text('PÉRIODE', marge + largeur * 0.5, yEntete, { width: largeur * 0.25, lineBreak: false });
  doc.text('MONTANT', marge, yEntete, { width: largeur, align: 'right', lineBreak: false });
  doc.fillColor('#0b1f3a');
  doc.moveDown(1);
  traitHorizontal(doc);

  const yLigne = doc.y;
  doc.font('Helvetica').fontSize(10);
  doc.text(`Abonnement ${data.plan}`, marge, yLigne, { width: largeur * 0.5, lineBreak: false });
  doc.text(formaterPeriode(data.periodeDebut, data.periodeFin), marge + largeur * 0.5, yLigne, {
    width: largeur * 0.25,
    lineBreak: false,
  });
  doc.text(formaterMontant(data.montant, data.devise), marge, yLigne, {
    width: largeur,
    align: 'right',
    lineBreak: false,
  });
  doc.moveDown(1);
  traitHorizontal(doc);

  doc.moveDown(0.4);
  ligneDeuxColonnes(doc, '', `TOTAL   ${formaterMontant(data.montant, data.devise)}`, {
    gras: true,
    taille: 12,
  });
  doc.moveDown(0.6);
  traitHorizontal(doc);

  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Durée : ${calculerDureeMois(data.periodeDebut, data.periodeFin)} mois`);
  doc.text(`Mode de paiement : ${LIBELLES_MODE[data.modePaiement] ?? data.modePaiement}`);
  doc.text(`Statut : ${LIBELLES_STATUT[data.statut] ?? data.statut}`);
  if (data.referencePaiement) {
    doc.text(`Référence de paiement : ${data.referencePaiement}`);
  }
  doc.moveDown(1.2);

  doc.font('Helvetica').fontSize(9).text('Merci pour votre confiance.', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).text('Fotall-Ma Pro', { align: 'center' });

  doc.end();
  return fin;
}
