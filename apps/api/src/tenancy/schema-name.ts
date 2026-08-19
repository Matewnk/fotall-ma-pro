// Un seul format de nom de schema pour tout le cycle de vie d'un tenant
// (provisioning, connexion applicative, suppression). Derive uniquement
// d'un UUID genere par le serveur (jamais d'entree client), donc sans
// risque d'injection dans les identifiants SQL construits a partir de lui.
export function schemaNameForTenant(tenantId: string): string {
  return `tenant_${tenantId.replace(/-/g, '')}`;
}
