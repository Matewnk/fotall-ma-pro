import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { TicketsService } from './tickets.service';

function makeTenantPrismaFactoryMock() {
  const commande = { findUnique: jest.fn() };
  return { commande, forTenant: jest.fn().mockReturnValue({ commande }) };
}

function makePrismaMock() {
  return { tenant: { findUniqueOrThrow: jest.fn() } };
}

describe('TicketsService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: TicketsService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    prisma = makePrismaMock();
    service = new TicketsService(tenantPrisma as never, prisma as never);
  });

  it('assemble les données du ticket à partir de la commande, du client et du tenant', async () => {
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      nomPressing: 'Pressing Test',
      adresse: '12 rue Test',
      telephone: '+221770000000',
    });
    tenantPrisma.commande.findUnique.mockResolvedValue({
      numero: 12,
      estProvisoire: false,
      client: { nom: 'Awa Diop', telephone: '+221701234567' },
      articles: [
        {
          service: { intitule: 'Lavage simple' },
          quantite: 2,
          tarifUnitaire: new Prisma.Decimal('1000.00'),
          sousTotal: new Prisma.Decimal('2000.00'),
        },
      ],
      sousTotal: new Prisma.Decimal('2000.00'),
      remise: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('2000.00'),
      datePrevue: null,
      modeLivraison: 'RETRAIT',
      adresseLivraison: null,
      statut: 'EN_ATTENTE',
    });

    const data = await service.getTicketData('tenant-1', 'commande-1');

    expect(data.numero).toBe(12);
    expect(data.client.nom).toBe('Awa Diop');
    expect(data.articles).toEqual([
      { intitule: 'Lavage simple', quantite: 2, tarifUnitaire: '1000', sousTotal: '2000' },
    ]);
    expect(data.total).toBe('2000');
  });

  it('lève NotFoundException si la commande est introuvable', async () => {
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      nomPressing: 'x',
      adresse: null,
      telephone: null,
    });
    tenantPrisma.commande.findUnique.mockResolvedValue(null);

    await expect(service.getTicketData('tenant-1', 'inconnue')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('genererPdf et genererEscPos produisent des buffers non vides', async () => {
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      nomPressing: 'Pressing Test',
      adresse: null,
      telephone: null,
    });
    tenantPrisma.commande.findUnique.mockResolvedValue({
      numero: 1,
      estProvisoire: true,
      client: { nom: 'Client Test', telephone: '+221700000000' },
      articles: [],
      sousTotal: new Prisma.Decimal('0.00'),
      remise: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('0.00'),
      datePrevue: null,
      modeLivraison: 'RETRAIT',
      adresseLivraison: null,
      statut: 'EN_ATTENTE',
    });

    const pdf = await service.genererPdf('tenant-1', 'commande-1');
    const escpos = await service.genererEscPos('tenant-1', 'commande-1', 58);

    expect(pdf.length).toBeGreaterThan(0);
    expect(escpos.length).toBeGreaterThan(0);
    expect(escpos.toString('ascii')).toContain('PROVISOIRE');
  });

  it('genererBonLivraisonPdf produit un buffer PDF non vide', async () => {
    prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      nomPressing: 'Pressing Test',
      adresse: null,
      telephone: null,
    });
    tenantPrisma.commande.findUnique.mockResolvedValue({
      numero: 5,
      estProvisoire: false,
      client: { nom: 'Client Test', telephone: '+221700000000' },
      articles: [
        {
          service: { intitule: 'Pantalon' },
          quantite: 3,
          tarifUnitaire: new Prisma.Decimal('1000.00'),
          sousTotal: new Prisma.Decimal('3000.00'),
        },
      ],
      sousTotal: new Prisma.Decimal('3000.00'),
      remise: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('3000.00'),
      datePrevue: null,
      modeLivraison: 'LIVRAISON',
      adresseLivraison: '10 rue Test',
      statut: 'PRET',
    });

    const buffer = await service.genererBonLivraisonPdf('tenant-1', 'commande-1');

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
