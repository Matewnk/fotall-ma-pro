import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { schemaNameForTenant } from './schema-name';

// __dirname pointe vers src/tenancy en dev (ts-node) et dist/tenancy en
// build ; dans les deux cas prisma/ est deux niveaux au-dessus, a la racine
// du package apps/api.
const MIGRATION_SQL_PATH = join(
  __dirname,
  '..',
  '..',
  'prisma',
  'tenant',
  'migrations',
  '20260819130000_init_audit_log',
  'migration.sql',
);

// Isolation physique V1 (ADR-001) : chaque tenant a son propre schema
// PostgreSQL. Provisionne au moment de la creation du tenant, jamais
// paresseusement au premier acces, pour ne jamais servir de requete
// tenant-scoped sans schema pret.
@Injectable()
export class TenantSchemaProvisioner {
  private readonly logger = new Logger(TenantSchemaProvisioner.name);

  constructor(private readonly config: ConfigService) {}

  async provision(tenantId: string): Promise<void> {
    const schema = schemaNameForTenant(tenantId);
    const client = new Client({ connectionString: this.config.getOrThrow<string>('DATABASE_URL') });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const migrationSql = readFileSync(MIGRATION_SQL_PATH, 'utf-8');
      await client.query(migrationSql);
      this.logger.log(`Schema tenant provisionné : ${schema}`);
    } finally {
      await client.end();
    }
  }

  // Compensation si le provisioning echoue apres creation du tenant en
  // control-plane, ou nettoyage des fixtures de test.
  async drop(tenantId: string): Promise<void> {
    const schema = schemaNameForTenant(tenantId);
    const client = new Client({ connectionString: this.config.getOrThrow<string>('DATABASE_URL') });
    await client.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await client.end();
    }
  }
}
