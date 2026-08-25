const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

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

// Point d'entrée unique pour tout appel API : injecte le Bearer token
// (localStorage, voir auth-context.tsx) et normalise les erreurs Nest
// ({statusCode, message, error}) en ApiError exploitable par les pages.
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

// Pour l'envoi de fichiers (multipart/form-data, ex. logo tenant) : jamais
// de Content-Type explicite — le navigateur doit fixer lui-même la
// boundary multipart, contrairement à apiFetch qui force toujours du JSON.
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { token?: string | null | undefined } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });

  const texte = await res.text();
  const corps: unknown = texte ? JSON.parse(texte) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, extraireMessage(corps));
  }
  return corps as T;
}

// Pour les réponses binaires (PDF, ESC/POS) : mêmes en-têtes que apiFetch,
// mais sans tenter de parser le corps en JSON (voir tickets.controller.ts,
// qui renvoie des octets bruts via @Res()).
export async function apiFetchBlob(
  path: string,
  options: { token?: string | null | undefined } = {},
): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const texte = await res.text();
    const corps: unknown = texte ? JSON.parse(texte) : undefined;
    throw new ApiError(res.status, extraireMessage(corps));
  }
  return res.blob();
}
