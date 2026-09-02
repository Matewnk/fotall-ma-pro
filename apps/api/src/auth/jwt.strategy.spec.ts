import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

function makePrismaMock() {
  return { user: { findUnique: jest.fn() } };
}

describe('JwtStrategy — vérification d’appartenance user → tenant', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = makePrismaMock();
    const config = new ConfigService({ JWT_SECRET: 'test-secret' });
    strategy = new JwtStrategy(config, prisma as never);
  });

  it('accepte un payload cohérent avec l’état actuel en base', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: true,
    });

    const context = await strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
    });

    expect(context).toEqual({ userId: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN });
  });

  it('rejette si l’utilisateur n’existe plus', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejette si l’utilisateur est désactivé', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: false,
    });

    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejette un tenant_id falsifié/désynchronisé du token (appartenance rompue)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-reel',
      role: Role.ADMIN,
      actif: true,
    });

    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-falsifie', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejette un rôle désynchronisé du token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.CAISSIER,
      actif: true,
    });

    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejette un tokenVersion périmé (session révoquée par un reset de mot de passe)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: true,
      tokenVersion: 2,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        tenantId: 'tenant-1',
        role: Role.ADMIN,
        tokenVersion: 1,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un tokenVersion à jour', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: true,
      tokenVersion: 1,
    });

    const context = await strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      tokenVersion: 1,
    });

    expect(context).toEqual({ userId: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN });
  });

  it('bloque (403) tant que mustChangePassword est actif', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: true,
      mustChangePassword: true,
    });

    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
