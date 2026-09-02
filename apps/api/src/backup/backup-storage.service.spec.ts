import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BackupStorageService } from './backup-storage.service';

describe('BackupStorageService', () => {
  let dossier: string;
  let service: BackupStorageService;

  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), 'fotall-backup-test-'));
    service = new BackupStorageService(
      new ConfigService({ BACKUP_STORAGE_DIR: dossier, BACKUP_RETENTION_JOURS: '30' }),
    );
  });

  afterEach(() => {
    rmSync(dossier, { recursive: true, force: true });
  });

  it('écrit la sauvegarde dans un sous-dossier propre au tenant', () => {
    const chemin = service.enregistrer('tenant-1', Buffer.from('CREATE SCHEMA ...;'));

    expect(existsSync(chemin)).toBe(true);
    expect(chemin).toContain(join(dossier, 'tenant-1'));
  });

  it('purgerAnciennes ne supprime rien tant que la rétention n’est pas dépassée', () => {
    service.enregistrer('tenant-1', Buffer.from('dump récent'));

    const supprimes = service.purgerAnciennes('tenant-1');

    expect(supprimes).toBe(0);
    expect(readdirSync(join(dossier, 'tenant-1')).length).toBe(1);
  });

  it('purgerAnciennes supprime les sauvegardes plus vieilles que la rétention configurée', () => {
    const chemin = service.enregistrer('tenant-1', Buffer.from('dump ancien'));
    const ilYA40Jours = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    utimesSync(chemin, ilYA40Jours, ilYA40Jours);

    const supprimes = service.purgerAnciennes('tenant-1');

    expect(supprimes).toBe(1);
    expect(readdirSync(join(dossier, 'tenant-1')).length).toBe(0);
  });

  it('purgerAnciennes ne plante pas si le tenant n’a encore aucune sauvegarde', () => {
    expect(service.purgerAnciennes('tenant-jamais-sauvegarde')).toBe(0);
  });
});
