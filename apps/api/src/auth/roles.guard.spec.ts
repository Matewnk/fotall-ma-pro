import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function makeContext(user: { role: Role } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('autorise quand aucun rôle n’est requis sur la route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext({ role: Role.CAISSIER }))).toBe(true);
  });

  it('autorise quand le rôle de l’utilisateur est dans la liste requise', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('refuse quand le rôle ne correspond pas', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext({ role: Role.ADMIN }))).toThrow(ForbiddenException);
  });

  it('refuse quand il n’y a pas d’utilisateur authentifié', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
