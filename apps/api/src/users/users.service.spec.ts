import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UsersService } from './users.service';

function makePrismaMock() {
  return {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeAuditServiceMock() {
  return { create: jest.fn() };
}

const UTILISATEUR = {
  id: 'user-1',
  email: 'caissier@pressing.dev',
  role: Role.CAISSIER,
  actif: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  motDePasseHash: 'hash-secret',
};

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auditService: ReturnType<typeof makeAuditServiceMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    auditService = makeAuditServiceMock();
    service = new UsersService(prisma as never, auditService as never);
  });

  it('create hache le mot de passe et ne renvoie jamais le hash', async () => {
    prisma.user.create.mockResolvedValue(UTILISATEUR);

    const resultat = await service.create('tenant-1', 'admin-1', {
      email: 'caissier@pressing.dev',
      motDePasse: 'super-secret-1',
      role: Role.CAISSIER,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', email: 'caissier@pressing.dev' }),
      }),
    );
    const motDePasseHashEnvoye = prisma.user.create.mock.calls[0][0].data.motDePasseHash;
    expect(motDePasseHashEnvoye).not.toBe('super-secret-1');
    expect(resultat).not.toHaveProperty('motDePasseHash');
  });

  it('create journalise la création dans AuditLog', async () => {
    prisma.user.create.mockResolvedValue(UTILISATEUR);

    await service.create('tenant-1', 'admin-1', {
      email: 'caissier@pressing.dev',
      motDePasse: 'super-secret-1',
      role: Role.CAISSIER,
    });

    expect(auditService.create).toHaveBeenCalledWith(
      'tenant-1',
      'admin-1',
      expect.objectContaining({
        action: 'UTILISATEUR_CREE',
        entityType: 'User',
        entityId: 'user-1',
      }),
    );
  });

  it('create lève ConflictException si email déjà utilisé dans le tenant', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );

    await expect(
      service.create('tenant-1', 'admin-1', {
        email: 'caissier@pressing.dev',
        motDePasse: 'super-secret-1',
        role: Role.CAISSIER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.create).not.toHaveBeenCalled();
  });

  it('list retourne les utilisateurs du tenant sans le hash', async () => {
    prisma.user.findMany.mockResolvedValue([UTILISATEUR]);

    const resultat = await service.list('tenant-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(resultat[0]).not.toHaveProperty('motDePasseHash');
  });

  it('update refuse qu’un utilisateur se désactive lui-même', async () => {
    await expect(
      service.update('tenant-1', 'user-1', 'user-1', { actif: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditService.create).not.toHaveBeenCalled();
  });

  it('update lève NotFoundException si l’utilisateur n’appartient pas au tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.update('tenant-1', 'user-2', 'user-1', { role: Role.TECHNICIEN }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update applique le nouveau rôle et journalise ancien/nouveau rôle', async () => {
    prisma.user.findFirst.mockResolvedValue(UTILISATEUR);
    prisma.user.update.mockResolvedValue({ ...UTILISATEUR, role: Role.TECHNICIEN });

    const resultat = await service.update('tenant-1', 'user-1', 'user-99', {
      role: Role.TECHNICIEN,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: Role.TECHNICIEN },
    });
    expect(resultat.role).toBe(Role.TECHNICIEN);
    expect(auditService.create).toHaveBeenCalledWith(
      'tenant-1',
      'user-99',
      expect.objectContaining({
        action: 'UTILISATEUR_MODIFIE',
        entityType: 'User',
        entityId: 'user-1',
        metadata: expect.objectContaining({
          ancienRole: Role.CAISSIER,
          nouveauRole: Role.TECHNICIEN,
        }),
      }),
    );
  });

  it('resetMotDePasse lève NotFoundException si l’utilisateur n’appartient pas au tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.resetMotDePasse('tenant-1', 'user-inconnu', 'admin-1', {
        motDePasse: 'nouveau-secret-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditService.create).not.toHaveBeenCalled();
  });

  it('resetMotDePasse hache le nouveau mot de passe, l’enregistre et journalise (sans le hash)', async () => {
    prisma.user.findFirst.mockResolvedValue(UTILISATEUR);
    prisma.user.update.mockResolvedValue(UTILISATEUR);

    await service.resetMotDePasse('tenant-1', 'user-1', 'admin-1', {
      motDePasse: 'nouveau-secret-1',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { motDePasseHash: expect.any(String) },
    });
    const hashEnvoye = prisma.user.update.mock.calls[0][0].data.motDePasseHash;
    expect(hashEnvoye).not.toBe('nouveau-secret-1');

    expect(auditService.create).toHaveBeenCalledWith(
      'tenant-1',
      'admin-1',
      expect.objectContaining({
        action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE',
        entityType: 'User',
        entityId: 'user-1',
      }),
    );
    const metadataEnvoyee = auditService.create.mock.calls[0][2];
    expect(JSON.stringify(metadataEnvoyee)).not.toContain('nouveau-secret-1');
  });
});
