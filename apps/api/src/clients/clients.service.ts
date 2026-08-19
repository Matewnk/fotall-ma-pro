import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  create(tenantId: string, dto: CreateClientDto) {
    return this.tenantPrisma.forTenant(tenantId).client.create({ data: dto });
  }

  // Recherche par nom et/ou téléphone (cahier des charges §5.2), toujours
  // scopée par construction : la connexion elle-même est bornée au schéma
  // du tenant (voir TenantPrismaFactory), impossible de fuiter vers un
  // autre tenant même en cas d'oubli d'un filtre applicatif.
  list(tenantId: string, nom?: string, telephone?: string) {
    const where: Prisma.ClientWhereInput = {};
    if (nom !== undefined) {
      where.nom = { contains: nom, mode: 'insensitive' };
    }
    if (telephone !== undefined) {
      where.telephone = { contains: telephone };
    }

    return this.tenantPrisma.forTenant(tenantId).client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const client = await this.tenantPrisma.forTenant(tenantId).client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException();
    }
    return client;
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    await this.findById(tenantId, id);
    return this.tenantPrisma.forTenant(tenantId).client.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    await this.tenantPrisma.forTenant(tenantId).client.delete({ where: { id } });
  }

  async exportCsv(tenantId: string): Promise<string> {
    const clients = await this.tenantPrisma.forTenant(tenantId).client.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const entetes = ['id', 'nom', 'telephone', 'email', 'adresse', 'statut', 'createdAt'];
    const lignes = clients.map((client) =>
      [
        client.id,
        client.nom,
        client.telephone,
        client.email ?? '',
        client.adresse ?? '',
        client.statut,
        client.createdAt.toISOString(),
      ]
        .map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [entetes.join(','), ...lignes].join('\n');
  }
}
