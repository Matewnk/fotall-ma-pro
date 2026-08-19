import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

// Chaque methode exige explicitement tenantId + actorId issus du
// TenantContext verifie (jamais d'un DTO ou d'un parametre de requete) :
// c'est l'appelant (le controller) qui doit les fournir depuis
// @CurrentTenant(), jamais depuis le corps ou la query de la requete.
@Injectable()
export class AuditService {
  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  create(tenantId: string, actorId: string, dto: CreateAuditLogDto) {
    return this.tenantPrisma.forTenant(tenantId).auditLog.create({
      data: {
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        actorId,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async findById(tenantId: string, id: string) {
    const entry = await this.tenantPrisma
      .forTenant(tenantId)
      .auditLog.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException();
    }
    return entry;
  }

  list(tenantId: string, action?: string) {
    const where: Prisma.AuditLogWhereInput = {};
    if (action !== undefined) {
      where.action = action;
    }
    return this.tenantPrisma.forTenant(tenantId).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
