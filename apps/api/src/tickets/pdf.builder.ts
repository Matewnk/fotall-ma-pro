import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { TicketData } from './ticket-data';

export async function buildPdfTicket(data: TicketData): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(`FOTALL-MA:COMMANDE:${data.numero}`, {
    type: 'png',
    margin: 1,
    width: 120,
  });

  const doc = new PDFDocument({ size: [227, 500], margin: 12 }); // ~80mm de large
  const morceaux: Buffer[] = [];
  doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
  const fin = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
  });

  if (data.estProvisoire) {
    doc.fontSize(10).text('** NUMÉRO PROVISOIRE **', { align: 'center' });
    doc.moveDown(0.3);
  }

  doc.fontSize(14).text(data.nomPressing, { align: 'center' });
  if (data.adresseTenant) {
    doc.fontSize(8).text(data.adresseTenant, { align: 'center' });
  }
  if (data.telephoneTenant) {
    doc.fontSize(8).text(data.telephoneTenant, { align: 'center' });
  }
  doc.moveDown(0.5);

  doc.fontSize(11).text(`Commande #${data.numero}${data.estProvisoire ? ' (provisoire)' : ''}`, {
    align: 'left',
  });
  doc.fontSize(9).text(`Client : ${data.client.nom} — ${data.client.telephone}`);
  doc.fontSize(9).text(`Statut : ${data.statut}`);
  doc.moveDown(0.5);

  for (const article of data.articles) {
    doc.fontSize(9).text(`${article.quantite} x ${article.intitule} — ${article.sousTotal}`);
  }
  doc.moveDown(0.3);

  doc.fontSize(9).text(`Sous-total : ${data.sousTotal}`);
  if (data.remise !== '0' && data.remise !== '0.00') {
    doc.fontSize(9).text(`Remise : -${data.remise}`);
  }
  doc.fontSize(11).text(`TOTAL : ${data.total}`);
  doc.moveDown(0.3);

  doc.fontSize(9).text(`Mode : ${data.modeLivraison}`);
  if (data.adresseLivraison) {
    doc.fontSize(9).text(`Livraison : ${data.adresseLivraison}`);
  }
  if (data.datePrevue) {
    doc.fontSize(9).text(`Prévu le : ${data.datePrevue.toISOString().slice(0, 10)}`);
  }

  doc.moveDown(0.5);
  doc.image(qrPng, { fit: [100, 100], align: 'center' });

  doc.end();
  return fin;
}
