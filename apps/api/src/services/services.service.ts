import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CATALOGUE_STANDARD } from './catalogue-standard.constants';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  async create(tenantId: string, dto: CreateServiceDto) {
    try {
      return await this.tenantPrisma.forTenant(tenantId).service.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Le code ${dto.code} est déjà utilisé.`);
      }
      throw error;
    }
  }

  list(tenantId: string, actif?: boolean) {
    const where: Prisma.ServiceWhereInput = {};
    if (actif !== undefined) {
      where.actif = actif;
    }
    return this.tenantPrisma
      .forTenant(tenantId)
      .service.findMany({ where, orderBy: { code: 'asc' } });
  }

  async findById(tenantId: string, id: string) {
    const service = await this.tenantPrisma
      .forTenant(tenantId)
      .service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException();
    }
    return service;
  }

  async update(tenantId: string, id: string, dto: UpdateServiceDto) {
    await this.findById(tenantId, id);
    return this.tenantPrisma.forTenant(tenantId).service.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.tenantPrisma.forTenant(tenantId).service.delete({ where: { id } });
  }

  // Appelé depuis OnboardingService.completerEtape2 quand le tenant choisit
  // CATALOGUE_STANDARD. Tarifs indicatifs, modifiables immédiatement
  // (cahier des charges §6.1) — de simples PATCH ultérieurs suffisent.
  async seedCatalogueStandard(tenantId: string): Promise<void> {
    const client = this.tenantPrisma.forTenant(tenantId);
    await client.service.createMany({ data: CATALOGUE_STANDARD, skipDuplicates: true });
  }
}
