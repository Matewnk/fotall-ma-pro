import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

type PrismaTx = {
  tenant: { create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  user: { create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
};

function makePrismaMock() {
  const tx: PrismaTx = {
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
  return {
    ...tx,
    $transaction: jest.fn((callback: (tx: PrismaTx) => unknown) => callback(tx)),
  };
}

function makeSchemaProvisionerMock() {
  return {
    provision: jest.fn().mockResolvedValue(undefined),
    drop: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let schemaProvisioner: ReturnType<typeof makeSchemaProvisionerMock>;
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    schemaProvisioner = makeSchemaProvisionerMock();
    jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
    service = new AuthService(prisma as never, jwt, schemaProvisioner as never);
  });

  describe('register', () => {
    it('creates a tenant and its first ADMIN user, and returns a signed session', async () => {
      prisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.dev',
        role: Role.ADMIN,
      });

      const result = await service.register({
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
        email: 'admin@test.dev',
        motDePasse: 'super-secret-1',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', role: Role.ADMIN }),
        }),
      );
      expect(schemaProvisioner.provision).toHaveBeenCalledWith('tenant-1');
      expect(result.tenant).toEqual({
        id: 'tenant-1',
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
      });
      const decoded = jwt.verify(result.accessToken);
      expect(decoded).toMatchObject({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN });
    });

    it('rolls back le tenant et l’utilisateur si le provisioning du schéma échoue', async () => {
      prisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.dev',
        role: Role.ADMIN,
      });
      schemaProvisioner.provision.mockRejectedValue(new Error('DB indisponible'));

      await expect(
        service.register({
          nomPressing: 'Pressing Test',
          sousDomaine: 'pressing-test',
          email: 'admin@test.dev',
          motDePasse: 'super-secret-1',
        }),
      ).rejects.toThrow('DB indisponible');

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(prisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    });

    it('rejects a duplicate sousDomaine with a ConflictException', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '5.20.0',
        }),
      );

      await expect(
        service.register({
          nomPressing: 'Pressing Test',
          sousDomaine: 'pressing-test',
          email: 'admin@test.dev',
          motDePasse: 'super-secret-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects when the tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ sousDomaine: 'inconnu', email: 'a@b.dev', motDePasse: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the password does not match', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', sousDomaine: 'pressing-test' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        actif: true,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
        role: Role.ADMIN,
      });

      await expect(
        service.login({
          sousDomaine: 'pressing-test',
          email: 'admin@test.dev',
          motDePasse: 'faux',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a deactivated user even with the correct password', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', sousDomaine: 'pressing-test' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        actif: false,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
        role: Role.ADMIN,
      });

      await expect(
        service.login({
          sousDomaine: 'pressing-test',
          email: 'admin@test.dev',
          motDePasse: 'le-bon-mot-de-passe',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a session for valid, active credentials', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.dev',
        actif: true,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
        role: Role.ADMIN,
      });

      const result = await service.login({
        sousDomaine: 'pressing-test',
        email: 'admin@test.dev',
        motDePasse: 'le-bon-mot-de-passe',
      });

      const decoded = jwt.verify(result.accessToken);
      expect(decoded).toMatchObject({ sub: 'user-1', tenantId: 'tenant-1', role: Role.ADMIN });
    });
  });
});
