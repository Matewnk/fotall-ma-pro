export interface ConnexionPostgres {
  host: string;
  port: string;
  utilisateur: string;
  motDePasse: string;
  base: string;
}

// pg_dump/psql (backup.service.ts) prennent des arguments de connexion
// séparés plutôt qu'une chaîne de connexion unique — DATABASE_URL est
// déjà utilisée telle quelle par Prisma/pg ailleurs (tenant-schema.provisioner.ts),
// ce parseur en extrait les mêmes composants sans dépendance supplémentaire.
export function analyserDatabaseUrl(databaseUrl: string): ConnexionPostgres {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    utilisateur: decodeURIComponent(url.username),
    motDePasse: decodeURIComponent(url.password),
    base: url.pathname.replace(/^\//, ''),
  };
}
