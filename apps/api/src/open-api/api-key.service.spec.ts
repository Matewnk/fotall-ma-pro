import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { hacherCle, PREFIXE_CLE } from './api-key.constants';

function makePrismaMock() {
  return {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ApiKeyService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ApiKeyService;
  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ApiKeyService(prisma as never);
  });

  describe('creer', () => {
    it('génère une clé en clair, stocke uniquement son hash, et retourne la clé en clair une seule fois', async () => {
      prisma.apiKey.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'key-1', ...data }),
      );

      const resultat = await service.creer(tenantId, {
        nom: 'Intégration Test',
        scopes: ['clients:read'],
      });

      expect(resultat.cleClaire.startsWith(PREFIXE_CLE)).toBe(true);
      const donneesCreation = prisma.apiKey.create.mock.calls[0][0].data;
      expect(donneesCreation.cleHachee).toBe(hacherCle(resultat.cleClaire));
      expect(donneesCreation.cleHachee).not.toBe(resultat.cleClaire);
      expect(donneesCreation.clePrefixe).toBe(
        resultat.cleClaire.slice(0, donneesCreation.clePrefixe.length),
      );
    });

    it('applique le quota par défaut si non fourni', async () => {
      prisma.apiKey.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'key-1', ...data }),
      );

      await service.creer(tenantId, { nom: 'X', scopes: ['clients:read'] });

      expect(prisma.apiKey.create.mock.calls[0][0].data.quotaJour).toBe(1000);
    });
  });

  describe('revoquer', () => {
    it('marque la clé révoquée quand elle appartient au tenant', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', tenantId });

      await service.revoquer(tenantId, 'key-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { revoqueeAt: expect.any(Date) },
      });
    });

    it('lève NotFoundException si la clé appartient à un autre tenant', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', tenantId: 'autre-tenant' });

      await expect(service.revoquer(tenantId, 'key-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la clé est introuvable', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.revoquer(tenantId, 'inconnue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('verifierEtConsommerQuota', () => {
    it('accepte une clé valide et incrémente le compteur du jour', async () => {
      const maintenant = new Date();
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId,
        scopes: ['clients:read'],
        revoqueeAt: null,
        quotaJour: 1000,
        compteurJour: 5,
        compteurReinitialiseA: maintenant,
      });

      const contexte = await service.verifierEtConsommerQuota('fmp_live_abc');

      expect(contexte).toEqual({ tenantId, scopes: ['clients:read'], apiKeyId: 'key-1' });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: expect.objectContaining({ compteurJour: 6 }),
      });
    });

    it('rejette une clé révoquée', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', revoqueeAt: new Date() });

      await expect(service.verifierEtConsommerQuota('fmp_live_abc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejette une clé inconnue', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.verifierEtConsommerQuota('fmp_live_inconnue')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejette quand le quota du jour est atteint', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId,
        scopes: [],
        revoqueeAt: null,
        quotaJour: 10,
        compteurJour: 10,
        compteurReinitialiseA: new Date(),
      });

      await expect(service.verifierEtConsommerQuota('fmp_live_abc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('remet le compteur à zéro dès qu’un nouveau jour commence', async () => {
      const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId,
        scopes: [],
        revoqueeAt: null,
        quotaJour: 10,
        compteurJour: 10,
        compteurReinitialiseA: hier,
      });

      const contexte = await service.verifierEtConsommerQuota('fmp_live_abc');

      expect(contexte.tenantId).toBe(tenantId);
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: expect.objectContaining({ compteurJour: 1 }),
      });
    });
  });
});
