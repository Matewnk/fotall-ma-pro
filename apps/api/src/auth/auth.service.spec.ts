import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

type PrismaTx = {
  tenant: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    delete: jest.Mock;
  };
  user: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makePrismaMock() {
  const tx: PrismaTx = {
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
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

function makeLicenceServiceMock() {
  return { creerEssai: jest.fn().mockResolvedValue(undefined) };
}

function makeOnboardingServiceMock() {
  return { initier: jest.fn().mockResolvedValue(undefined) };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let schemaProvisioner: ReturnType<typeof makeSchemaProvisionerMock>;
  let licenceService: ReturnType<typeof makeLicenceServiceMock>;
  let onboardingService: ReturnType<typeof makeOnboardingServiceMock>;
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    schemaProvisioner = makeSchemaProvisionerMock();
    licenceService = makeLicenceServiceMock();
    onboardingService = makeOnboardingServiceMock();
    jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
    service = new AuthService(
      prisma as never,
      jwt,
      schemaProvisioner as never,
      licenceService as never,
      onboardingService as never,
    );
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

  describe('loginSuperAdmin', () => {
    it('rejects when no SUPER_ADMIN account matches this email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.loginSuperAdmin({ email: 'inconnu@fotall.dev', motDePasse: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('cherche uniquement parmi les comptes tenantId=null et role=SUPER_ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service
        .loginSuperAdmin({ email: 'super@fotall.dev', motDePasse: 'x' })
        .catch(() => undefined);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { tenantId: null, email: 'super@fotall.dev', role: Role.SUPER_ADMIN },
      });
    });

    it('rejects when the password does not match', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'super-1',
        email: 'super@fotall.dev',
        actif: true,
        role: Role.SUPER_ADMIN,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
      });

      await expect(
        service.loginSuperAdmin({ email: 'super@fotall.dev', motDePasse: 'faux' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a deactivated super-admin even with the correct password', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'super-1',
        email: 'super@fotall.dev',
        actif: false,
        role: Role.SUPER_ADMIN,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
      });

      await expect(
        service.loginSuperAdmin({ email: 'super@fotall.dev', motDePasse: 'le-bon-mot-de-passe' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a tenant-less session for valid, active credentials', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'super-1',
        email: 'super@fotall.dev',
        actif: true,
        role: Role.SUPER_ADMIN,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
      });

      const result = await service.loginSuperAdmin({
        email: 'super@fotall.dev',
        motDePasse: 'le-bon-mot-de-passe',
      });

      expect(result.tenant).toBeUndefined();
      const decoded = jwt.verify(result.accessToken);
      expect(decoded).toMatchObject({ sub: 'super-1', tenantId: null, role: Role.SUPER_ADMIN });
    });
  });

  describe('changerMotDePasse', () => {
    it('rejette un mot de passe actuel incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        role: Role.ADMIN,
        motDePasseHash: await bcrypt.hash('le-bon-mot-de-passe', 4),
        tokenVersion: 0,
        mustChangePassword: true,
      });

      await expect(
        service.changerMotDePasse('user-1', {
          motDePasseActuel: 'faux',
          motDePasseNouveau: 'nouveau-secret-1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rehash, désactive mustChangePassword, incrémente tokenVersion et réémet un token à jour', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        role: Role.ADMIN,
        email: 'admin@test.dev',
        motDePasseHash: await bcrypt.hash('ancien-mot-de-passe', 4),
        tokenVersion: 0,
        mustChangePassword: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        role: Role.ADMIN,
        email: 'admin@test.dev',
        tokenVersion: 1,
        mustChangePassword: false,
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        id: 'tenant-1',
        nomPressing: 'Pressing Test',
        sousDomaine: 'pressing-test',
      });

      const result = await service.changerMotDePasse('user-1', {
        motDePasseActuel: 'ancien-mot-de-passe',
        motDePasseNouveau: 'nouveau-secret-1',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          motDePasseHash: expect.any(String),
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      });
      const hashEnvoye = prisma.user.update.mock.calls[0][0].data.motDePasseHash;
      expect(hashEnvoye).not.toBe('nouveau-secret-1');

      expect(result.user.mustChangePassword).toBe(false);
      const decoded = jwt.verify(result.accessToken);
      expect(decoded).toMatchObject({ sub: 'user-1', tenantId: 'tenant-1', tokenVersion: 1 });
    });
  });
});
