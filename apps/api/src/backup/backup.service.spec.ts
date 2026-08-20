import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { schemaNameForTenant } from '../tenancy/schema-name';
import { BackupService } from './backup.service';

jest.mock('child_process');

function creerProcessusFactice(options: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  erreurSpawn?: Error;
}) {
  const { exitCode = 0, stdout = '', stderr = '', erreurSpawn } = options;
  const stdoutStream = new EventEmitter();
  const stderrStream = new EventEmitter();
  const stdinStream = { end: jest.fn() };
  const processus = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: typeof stdinStream;
  };
  processus.stdout = stdoutStream;
  processus.stderr = stderrStream;
  processus.stdin = stdinStream;

  setImmediate(() => {
    if (erreurSpawn) {
      processus.emit('error', erreurSpawn);
      return;
    }
    if (stdout) {
      stdoutStream.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      stderrStream.emit('data', Buffer.from(stderr));
    }
    processus.emit('close', exitCode);
  });

  return processus;
}

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = new ConfigService({
      DATABASE_URL: 'postgresql://fotall:secret@localhost:5432/fotall_test',
    });
    service = new BackupService(config);
  });

  describe('sauvegarderTenant', () => {
    it('appelle pg_dump borné au schéma du tenant et retourne le dump en sortie', async () => {
      (spawn as jest.Mock).mockReturnValue(creerProcessusFactice({ stdout: 'CREATE SCHEMA ...;' }));

      const tenantId = '11111111-1111-1111-1111-111111111111';
      const dump = await service.sauvegarderTenant(tenantId);

      expect(dump.toString()).toBe('CREATE SCHEMA ...;');
      const [commande, args, options] = (spawn as jest.Mock).mock.calls[0];
      expect(commande).toBe('pg_dump');
      expect(args).toEqual(expect.arrayContaining(['--schema', schemaNameForTenant(tenantId)]));
      expect(options.env.PGPASSWORD).toBe('secret');
    });

    it('rejette avec InternalServerErrorException si pg_dump échoue', async () => {
      (spawn as jest.Mock).mockReturnValue(
        creerProcessusFactice({ exitCode: 1, stderr: 'schema inconnu' }),
      );

      await expect(service.sauvegarderTenant('tenant-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('rejette si le binaire pg_dump est introuvable', async () => {
      (spawn as jest.Mock).mockReturnValue(
        creerProcessusFactice({ erreurSpawn: new Error('ENOENT') }),
      );

      await expect(service.sauvegarderTenant('tenant-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('restaurerTenant', () => {
    it('appelle psql avec le script de suppression suivi de la sauvegarde', async () => {
      const processusFactice = creerProcessusFactice({});
      (spawn as jest.Mock).mockReturnValue(processusFactice);

      const tenantId = '11111111-1111-1111-1111-111111111111';
      await service.restaurerTenant(tenantId, Buffer.from('CREATE TABLE x (id int);'));

      const [commande] = (spawn as jest.Mock).mock.calls[0];
      expect(commande).toBe('psql');
      const entreeEnvoyee = processusFactice.stdin.end.mock.calls[0][0] as Buffer;
      expect(entreeEnvoyee.toString()).toBe(
        `DROP SCHEMA IF EXISTS "${schemaNameForTenant(tenantId)}" CASCADE;\n` +
          'CREATE TABLE x (id int);',
      );
    });
  });
});
