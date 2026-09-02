import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { JwtLenientStrategy } from './jwt-lenient.strategy';

function makePrismaMock() {
  return { user: { findUnique: jest.fn() } };
}

// Contrairement a JwtStrategy : ne bloque jamais sur mustChangePassword —
// c'est justement la strategie utilisee par GET /auth/me et
// PATCH /auth/mot-de-passe, les deux routes qui doivent rester accessibles
// pendant l'ecran de changement de mot de passe obligatoire.
describe('JwtLenientStrategy', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let strategy: JwtLenientStrategy;

  beforeEach(() => {
    prisma = makePrismaMock();
    const config = new ConfigService({ JWT_SECRET: 'test-secret' });
    strategy = new JwtLenientStrategy(config, prisma as never);
  });

  it('accepte un utilisateur avec mustChangePassword actif', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
      actif: true,
      mustChangePassword: true,
    });

    const context = await strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: Role.ADMIN,
    });

    expect(context).toEqual({ userId: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN });
  });

  it('rejette quand même un utilisateur désactivé', async () => {
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

  it('rejette quand même un tokenVersion périmé', async () => {
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
});
