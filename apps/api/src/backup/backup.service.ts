import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { schemaNameForTenant } from '../tenancy/schema-name';
import { analyserDatabaseUrl } from './database-url';

// §15.8 "Les sauvegardes et restaurations doivent pouvoir être effectuées
// tenant par tenant" : chaque tenant vivant dans son propre schéma
// PostgreSQL (ADR-001), une sauvegarde/restauration par tenant est un
// pg_dump/psql borné à --schema=<schéma du tenant> — jamais la base
// entière, jamais un autre tenant. Format texte simple (--format=plain)
// plutôt que le format personnalisé de pg_dump : streamable directement
// entre pg_dump/psql sans fichier temporaire, restaurable par n'importe
// quel client psql standard.
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  async sauvegarderTenant(tenantId: string): Promise<Buffer> {
    const schema = schemaNameForTenant(tenantId);
    const connexion = analyserDatabaseUrl(this.config.getOrThrow<string>('DATABASE_URL'));

    return this.executer(
      'pg_dump',
      [
        '--host',
        connexion.host,
        '--port',
        connexion.port,
        '--username',
        connexion.utilisateur,
        '--dbname',
        connexion.base,
        '--schema',
        schema,
        '--format=plain',
        '--no-owner',
        '--no-privileges',
      ],
      connexion.motDePasse,
    );
  }

  // Destructif par nature (§15.8, opération de reprise après incident) :
  // le schéma existant est supprimé puis recréé depuis la sauvegarde,
  // jamais fusionné. L'appelant (backup.controller.ts) exige une
  // confirmation explicite et audite l'opération.
  async restaurerTenant(tenantId: string, sauvegarde: Buffer): Promise<void> {
    const schema = schemaNameForTenant(tenantId);
    const connexion = analyserDatabaseUrl(this.config.getOrThrow<string>('DATABASE_URL'));

    const scriptSuppression = `DROP SCHEMA IF EXISTS "${schema}" CASCADE;\n`;
    await this.executer(
      'psql',
      [
        '--host',
        connexion.host,
        '--port',
        connexion.port,
        '--username',
        connexion.utilisateur,
        '--dbname',
        connexion.base,
        '--variable=ON_ERROR_STOP=1',
      ],
      connexion.motDePasse,
      Buffer.concat([Buffer.from(scriptSuppression), sauvegarde]),
    );
  }

  private executer(
    commande: string,
    args: string[],
    motDePasse: string,
    entree?: Buffer,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const processus = spawn(commande, args, {
        env: { ...process.env, PGPASSWORD: motDePasse },
      });

      const sortie: Buffer[] = [];
      const erreurs: Buffer[] = [];
      processus.stdout.on('data', (morceau: Buffer) => sortie.push(morceau));
      processus.stderr.on('data', (morceau: Buffer) => erreurs.push(morceau));

      processus.on('error', (erreur) => {
        reject(
          new InternalServerErrorException(
            `${commande} introuvable ou non exécutable : ${erreur.message}`,
          ),
        );
      });

      processus.on('close', (code) => {
        if (code !== 0) {
          const message = Buffer.concat(erreurs).toString('utf-8');
          this.logger.error(`${commande} a échoué (code ${code}) : ${message}`);
          reject(new InternalServerErrorException(`${commande} a échoué.`));
          return;
        }
        resolve(Buffer.concat(sortie));
      });

      if (entree) {
        processus.stdin.end(entree);
      } else {
        processus.stdin.end();
      }
    });
  }
}
