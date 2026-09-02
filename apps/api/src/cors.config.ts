// §19.1 "sessions sécurisées" / docs/production-checklist.md : en
// développement, n'importe quelle origine est acceptée (Vite tourne sur
// un port variable, aucun risque — l'auth est par Bearer token, jamais un
// cookie). En production, CORS_ORIGINS doit lister explicitement le(s)
// domaine(s) du Web/mobile déployés — non configuré, on bloque tout
// plutôt que de retomber sur "origin: true" (échec visible et bruyant
// côté navigateur, jamais un trou de sécurité silencieux).
export function resoudreOriginsCors(
  environnement: string | undefined,
  originsEnv: string | undefined,
): boolean | string[] {
  if (environnement !== 'production') {
    return true;
  }
  const origines = (originsEnv ?? '')
    .split(',')
    .map((origine) => origine.trim())
    .filter(Boolean);
  return origines.length > 0 ? origines : false;
}
