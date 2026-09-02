import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_RETENTION_JOURS = 30;

// Stockage disque local — même choix que LogoStorageService
// (tenant-settings/logo-storage.service.ts) : aucun S3/MinIO dans la
// stack actuelle (décision utilisateur déjà actée pour les logos, reprise
// ici plutôt qu'un second choix de stockage). Ce répertoire doit vivre
// sur un disque durable, sauvegardé hors serveur par l'hébergement
// retenu — voir docs/production-checklist.md, qui documente cette
// limite explicitement.
@Injectable()
export class BackupStorageService {
  private readonly dossier: string;
  private readonly retentionJours: number;

  constructor(private readonly config: ConfigService) {
    this.dossier = this.config.get<string>('BACKUP_STORAGE_DIR') ?? join(process.cwd(), 'backups');
    this.retentionJours = Number(
      this.config.get<string>('BACKUP_RETENTION_JOURS') ?? DEFAULT_RETENTION_JOURS,
    );
  }

  enregistrer(tenantId: string, dump: Buffer): string {
    const dossierTenant = join(this.dossier, tenantId);
    mkdirSync(dossierTenant, { recursive: true });
    const nomFichier = `${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const chemin = join(dossierTenant, nomFichier);
    writeFileSync(chemin, dump);
    return chemin;
  }

  // Purge les sauvegardes plus anciennes que la rétention configurée —
  // sans ça, le disque se remplirait indéfiniment. Silencieux si le
  // tenant n'a encore aucune sauvegarde (dossier absent).
  purgerAnciennes(tenantId: string): number {
    const dossierTenant = join(this.dossier, tenantId);
    let fichiers: string[];
    try {
      fichiers = readdirSync(dossierTenant);
    } catch {
      return 0;
    }

    const limite = Date.now() - this.retentionJours * 24 * 60 * 60 * 1000;
    let supprimes = 0;
    for (const fichier of fichiers) {
      const chemin = join(dossierTenant, fichier);
      if (statSync(chemin).mtimeMs < limite) {
        unlinkSync(chemin);
        supprimes++;
      }
    }
    return supprimes;
  }
}
