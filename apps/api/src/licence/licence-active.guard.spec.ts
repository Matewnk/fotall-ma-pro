import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StatutLicence } from '@prisma/client';
import { LicenceActiveGuard } from './licence-active.guard';

function makeContext(tenantId: string | null): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: tenantId ? { tenantId } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('LicenceActiveGuard', () => {
  it('laisse passer une route non annotée @RequireActiveLicence()', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const licenceService = { getStatut: jest.fn() };
    const guard = new LicenceActiveGuard(reflector, licenceService as never);

    await expect(guard.canActivate(makeContext('tenant-1'))).resolves.toBe(true);
    expect(licenceService.getStatut).not.toHaveBeenCalled();
  });

  it.each([StatutLicence.ESSAI, StatutLicence.ACTIVE])(
    'autorise l’écriture quand le statut est %s',
    async (statut) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector;
      const licenceService = { getStatut: jest.fn().mockResolvedValue({ statut }) };
      const guard = new LicenceActiveGuard(reflector, licenceService as never);

      await expect(guard.canActivate(makeContext('tenant-1'))).resolves.toBe(true);
    },
  );

  it.each([StatutLicence.EXPIREE, StatutLicence.SUSPENDUE])(
    'bloque l’écriture (403) quand le statut est %s',
    async (statut) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector;
      const licenceService = { getStatut: jest.fn().mockResolvedValue({ statut }) };
      const guard = new LicenceActiveGuard(reflector, licenceService as never);

      await expect(guard.canActivate(makeContext('tenant-1'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('rejette une requête sans contexte tenant', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const licenceService = { getStatut: jest.fn() };
    const guard = new LicenceActiveGuard(reflector, licenceService as never);

    await expect(guard.canActivate(makeContext(null))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
