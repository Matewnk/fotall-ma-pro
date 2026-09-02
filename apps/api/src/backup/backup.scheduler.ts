import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActionSauvegarde } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupService } from './backup.service';

// Acteur technique enregistré dans JournalSauvegarde.effectuePar (simple
// chaîne descriptive, pas une clé étrangère vers User) — même convention
// que ACTEUR_SYSTEME_FACTURATION (billing/billing.constants.ts).
const ACTEUR_SYSTEME_SAUVEGARDE = 'systeme:sauvegarde-quotidienne';

// §15.8 / docs/production-checklist.md "Backups quotidiens" : le
// mécanisme existant (BackupService, jusqu'ici déclenché uniquement à la
// demande par le SUPER_ADMIN, backup.controller.ts) est ici planifié
// chaque nuit pour tous les tenants, sans action humaine. Un échec sur un
// tenant n'interrompt jamais les suivants — chaque échec est journalisé
// et le job continue (même principe que
// BillingService#relancerAbonnementsEnRetard).
@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly storage: BackupStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async sauvegarderTousLesTenants(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    this.logger.log(`Sauvegarde quotidienne : ${tenants.length} tenant(s) à traiter`);

    for (const { id: tenantId } of tenants) {
      try {
        const dump = await this.backupService.sauvegarderTenant(tenantId);
        this.storage.enregistrer(tenantId, dump);
        await this.prisma.journalSauvegarde.create({
          data: {
            tenantId,
            action: ActionSauvegarde.SAUVEGARDE,
            effectuePar: ACTEUR_SYSTEME_SAUVEGARDE,
            tailleOctets: dump.length,
          },
        });

        const purges = this.storage.purgerAnciennes(tenantId);
        if (purges > 0) {
          this.logger.log(`Tenant ${tenantId} : ${purges} sauvegarde(s) expirée(s) purgée(s)`);
        }
      } catch (error) {
        this.logger.error(
          `Échec de la sauvegarde quotidienne pour le tenant ${tenantId}`,
          error as Error,
        );
      }
    }
  }
}
