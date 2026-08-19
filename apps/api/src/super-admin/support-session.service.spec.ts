import { ConflictException } from '@nestjs/common';
import { SUPPORT_SESSION_MAX_DUREE_HEURES, SupportSessionService } from './support-session.service';

function makePrismaMock() {
  return {
    supportSession: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
}

describe('SupportSessionService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SupportSessionService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new SupportSessionService(prisma as never);
  });

  describe('demarrer', () => {
    it('crée une session (audit de début) quand aucune n’est active', async () => {
      prisma.supportSession.findFirst.mockResolvedValue(null);
      prisma.supportSession.create.mockResolvedValue({ id: 'session-1' });

      const session = await service.demarrer('tenant-1', 'super-admin-1', 'incident client');

      expect(session).toEqual({ id: 'session-1' });
      expect(prisma.supportSession.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', superAdminId: 'super-admin-1', motif: 'incident client' },
      });
    });

    it('refuse une deuxième session concurrente pour le même tenant/super-admin', async () => {
      prisma.supportSession.findFirst.mockResolvedValue({
        id: 'session-1',
        startedAt: new Date(),
        endedAt: null,
      });

      await expect(
        service.demarrer('tenant-1', 'super-admin-1', 'autre motif'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getActive', () => {
    it('retourne null si aucune session', async () => {
      prisma.supportSession.findFirst.mockResolvedValue(null);
      await expect(service.getActive('tenant-1', 'super-admin-1')).resolves.toBeNull();
    });

    it('retourne null si la session a dépassé la durée max (expirée)', async () => {
      const startedAt = new Date(
        Date.now() - (SUPPORT_SESSION_MAX_DUREE_HEURES + 1) * 60 * 60 * 1000,
      );
      prisma.supportSession.findFirst.mockResolvedValue({
        id: 'session-1',
        startedAt,
        endedAt: null,
      });

      await expect(service.getActive('tenant-1', 'super-admin-1')).resolves.toBeNull();
    });

    it('retourne la session si elle est récente et non terminée', async () => {
      const startedAt = new Date();
      prisma.supportSession.findFirst.mockResolvedValue({
        id: 'session-1',
        startedAt,
        endedAt: null,
      });

      await expect(service.getActive('tenant-1', 'super-admin-1')).resolves.toEqual({
        id: 'session-1',
        startedAt,
        endedAt: null,
      });
    });
  });

  describe('terminer', () => {
    it('clôture (audit de fin) une session active', async () => {
      prisma.supportSession.findFirst.mockResolvedValue({
        id: 'session-1',
        startedAt: new Date(),
        endedAt: null,
      });
      prisma.supportSession.update.mockResolvedValue({ id: 'session-1', endedAt: new Date() });

      const result = await service.terminer('tenant-1', 'super-admin-1');

      expect(result).not.toBeNull();
      expect(prisma.supportSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } }),
      );
    });

    it('ne fait rien (idempotent) si aucune session active', async () => {
      prisma.supportSession.findFirst.mockResolvedValue(null);

      await expect(service.terminer('tenant-1', 'super-admin-1')).resolves.toBeNull();
      expect(prisma.supportSession.update).not.toHaveBeenCalled();
    });
  });
});
