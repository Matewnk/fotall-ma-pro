import { Role } from '@prisma/client';
import { PermissionsService } from './permissions.service';

function makePrisma(overrides: { userId_permission?: unknown } = {}) {
  return {
    userPermission: {
      findUnique: jest.fn().mockResolvedValue(overrides.userId_permission ?? null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('PermissionsService', () => {
  describe('aLaPermission', () => {
    it('users.manage / users.permissions ne sont jamais accordables par override : ADMIN seul', async () => {
      const prisma = makePrisma();
      const service = new PermissionsService(prisma as never);

      await expect(service.aLaPermission('t1', 'u1', Role.ADMIN, 'users.manage')).resolves.toBe(
        true,
      );
      await expect(
        service.aLaPermission('t1', 'u1', Role.CAISSIER, 'users.manage'),
      ).resolves.toBe(false);
      expect(prisma.userPermission.findUnique).not.toHaveBeenCalled();
    });

    it('applique le défaut du rôle en absence d’override', async () => {
      const prisma = makePrisma();
      const service = new PermissionsService(prisma as never);

      await expect(
        service.aLaPermission('t1', 'u1', Role.CAISSIER, 'reports.export'),
      ).resolves.toBe(false);
      await expect(
        service.aLaPermission('t1', 'u1', Role.CAISSIER, 'commandes.encaisser'),
      ).resolves.toBe(true);
    });

    it('un ALLOW explicite accorde un droit absent du défaut du rôle', async () => {
      const prisma = makePrisma({
        userId_permission: { userId: 'u1', tenantId: 't1', permission: 'reports.export', effet: 'ALLOW' },
      });
      const service = new PermissionsService(prisma as never);

      await expect(
        service.aLaPermission('t1', 'u1', Role.CAISSIER, 'reports.export'),
      ).resolves.toBe(true);
    });

    it('un DENY explicite retire un droit présent par défaut dans le rôle', async () => {
      const prisma = makePrisma({
        userId_permission: {
          userId: 'u1',
          tenantId: 't1',
          permission: 'commandes.encaisser',
          effet: 'DENY',
        },
      });
      const service = new PermissionsService(prisma as never);

      await expect(
        service.aLaPermission('t1', 'u1', Role.CAISSIER, 'commandes.encaisser'),
      ).resolves.toBe(false);
    });

    it('ignore un override appartenant à un autre tenant (isolation)', async () => {
      const prisma = makePrisma({
        userId_permission: {
          userId: 'u1',
          tenantId: 'tenant-B',
          permission: 'reports.export',
          effet: 'ALLOW',
        },
      });
      const service = new PermissionsService(prisma as never);

      await expect(
        service.aLaPermission('tenant-A', 'u1', Role.CAISSIER, 'reports.export'),
      ).resolves.toBe(false);
    });
  });

  describe('getPermissionsEffectives', () => {
    it('combine défauts du rôle et overrides ALLOW/DENY', async () => {
      const prisma = {
        userPermission: {
          findMany: jest.fn().mockResolvedValue([
            { permission: 'reports.export', effet: 'ALLOW' },
            { permission: 'commandes.encaisser', effet: 'DENY' },
          ]),
        },
      };
      const service = new PermissionsService(prisma as never);

      const { effectives } = await service.getPermissionsEffectives('t1', 'u1', Role.CAISSIER);

      expect(effectives).toContain('reports.export');
      expect(effectives).not.toContain('commandes.encaisser');
      expect(effectives).toContain('clients.read');
    });

    it('un override DENY sur users.manage/users.permissions est sans effet', async () => {
      const prisma = {
        userPermission: {
          findMany: jest.fn().mockResolvedValue([{ permission: 'users.manage', effet: 'DENY' }]),
        },
      };
      const service = new PermissionsService(prisma as never);

      const { effectives } = await service.getPermissionsEffectives('t1', 'u1', Role.ADMIN);

      expect(effectives).toContain('users.manage');
    });
  });
});
