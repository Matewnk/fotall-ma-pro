import PDFDocument from 'pdfkit';
import { TableauRapport } from './reports.types';

function echapperCsv(valeur: string | number): string {
  const chaine = String(valeur);
  return /[",\n]/.test(chaine) ? `"${chaine.replace(/"/g, '""')}"` : chaine;
}

export function versCsv(tableau: TableauRapport): string {
  const lignes = [tableau.colonnes, ...tableau.lignes.map((ligne) => ligne.map(String))];
  const corps = lignes.map((ligne) => ligne.map(echapperCsv).join(',')).join('\n');
  if (!tableau.resume) {
    return `${corps}\n`;
  }
  const resume = Object.entries(tableau.resume)
    .map(([cle, valeur]) => `${echapperCsv(cle)},${echapperCsv(valeur)}`)
    .join('\n');
  return `${corps}\n\n${resume}\n`;
}

export async function versPdf(titre: string, tableau: TableauRapport): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const morceaux: Buffer[] = [];
  doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fin = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
  });

  doc.fontSize(16).text(titre, { align: 'left' });
  doc.moveDown(0.5);

  doc.fontSize(9).text(tableau.colonnes.join(' | '));
  doc.moveDown(0.2);
  for (const ligne of tableau.lignes) {
    doc.fontSize(9).text(ligne.map(String).join(' | '));
  }

  if (tableau.resume) {
    doc.moveDown(0.5);
    for (const [cle, valeur] of Object.entries(tableau.resume)) {
      doc.fontSize(10).text(`${cle} : ${valeur}`);
    }
  }

  doc.end();
  return fin;
}
