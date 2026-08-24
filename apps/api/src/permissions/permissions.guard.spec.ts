import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';

function makeContext(user?: {
  tenantId: string | null;
  userId: string;
  role: Role;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('laisse passer une route non annotée @RequirePermission()', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const permissionsService = { aLaPermission: jest.fn() };
    const guard = new PermissionsGuard(reflector, permissionsService as never);

    await expect(
      guard.canActivate(makeContext({ tenantId: 't1', userId: 'u1', role: Role.CAISSIER })),
    ).resolves.toBe(true);
    expect(permissionsService.aLaPermission).not.toHaveBeenCalled();
  });

  it('rejette une requête sans contexte tenant', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('reports.export'),
    } as unknown as Reflector;
    const permissionsService = { aLaPermission: jest.fn() };
    const guard = new PermissionsGuard(reflector, permissionsService as never);

    await expect(guard.canActivate(makeContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('autorise quand PermissionsService confirme le droit', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('reports.export'),
    } as unknown as Reflector;
    const permissionsService = { aLaPermission: jest.fn().mockResolvedValue(true) };
    const guard = new PermissionsGuard(reflector, permissionsService as never);

    await expect(
      guard.canActivate(makeContext({ tenantId: 't1', userId: 'u1', role: Role.CAISSIER })),
    ).resolves.toBe(true);
    expect(permissionsService.aLaPermission).toHaveBeenCalledWith(
      't1',
      'u1',
      Role.CAISSIER,
      'reports.export',
    );
  });

  it('bloque (403) quand PermissionsService refuse le droit', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('reports.export'),
    } as unknown as Reflector;
    const permissionsService = { aLaPermission: jest.fn().mockResolvedValue(false) };
    const guard = new PermissionsGuard(reflector, permissionsService as never);

    await expect(
      guard.canActivate(makeContext({ tenantId: 't1', userId: 'u1', role: Role.CAISSIER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
