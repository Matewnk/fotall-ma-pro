import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';
import { schemaNameForTenant } from './schema-name';

// Un PrismaClient par tenant, dont la connection string fixe le schema
// PostgreSQL cible (parametre `schema`). Toute requete emise via ce client
// ne peut physiquement voir que les lignes du schema du tenant concerne :
// l'isolation ne depend pas d'un filtre applicatif tenantId qu'on pourrait
// oublier d'ajouter.
@Injectable()
export class TenantPrismaFactory implements OnModuleDestroy {
  private readonly clients = new Map<string, TenantPrismaClient>();

  constructor(private readonly config: ConfigService) {}

  forTenant(tenantId: string): TenantPrismaClient {
    const existing = this.clients.get(tenantId);
    if (existing) {
      return existing;
    }

    const url = new URL(this.config.getOrThrow<string>('DATABASE_URL'));
    url.searchParams.set('schema', schemaNameForTenant(tenantId));

    const client = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });
    this.clients.set(tenantId, client);
    return client;
  }

  async onModuleDestroy() {
    await Promise.all(Array.from(this.clients.values()).map((client) => client.$disconnect()));
    this.clients.clear();
  }
}
