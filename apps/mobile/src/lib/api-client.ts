const BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:3000';

// Pour les écrans qui ont besoin de l'URL complète plutôt que d'un appel
// JSON — ex. FileSystem.downloadAsync (TicketScreen.tsx), qui gère
// lui-même l'en-tête Authorization.
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extraireMessage(corps: unknown): string {
  if (corps && typeof corps === 'object' && 'message' in corps) {
    const message = (corps as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Une erreur est survenue.';
}

// Équivalent mobile de apps/web/src/lib/api-client.ts#apiFetch (même
// contrat), pour les écrans qui appellent l'API directement en ligne. Le
// moteur de synchronisation offline (016, offline/api-client.ts) reste un
// contrat séparé — non branché sur ces écrans dans cette tranche (voir
// spec.md, périmètre différé).
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null | undefined } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const texte = await res.text();
  const corps: unknown = texte ? JSON.parse(texte) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, extraireMessage(corps));
  }
  return corps as T;
}
