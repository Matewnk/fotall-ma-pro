import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reponseJson } from '../test-utils';
import { apiFetch, apiFetchBlob, ApiError } from './api-client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('ajoute le Bearer token quand fourni', async () => {
    vi.mocked(fetch).mockResolvedValue(reponseJson({ ok: true }));

    await apiFetch('/dashboard', { token: 'abc123' });

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('n’ajoute pas d’en-tête Authorization sans token', async () => {
    vi.mocked(fetch).mockResolvedValue(reponseJson({ ok: true }));

    await apiFetch('/dashboard');

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('lève une ApiError avec le message Nest sur une réponse en erreur', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponseJson({ statusCode: 400, message: ['champ requis'], error: 'Bad Request' }, 400),
    );

    await expect(apiFetch('/clients', { method: 'POST', body: {} })).rejects.toMatchObject(
      new ApiError(400, 'champ requis'),
    );
  });

  it('retourne le corps JSON parsé sur succès', async () => {
    vi.mocked(fetch).mockResolvedValue(reponseJson({ id: 'x-1' }));

    const resultat = await apiFetch<{ id: string }>('/clients/x-1');

    expect(resultat).toEqual({ id: 'x-1' });
  });
});

describe('apiFetchBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('retourne le corps en Blob sur succès', async () => {
    const blobAttendu = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValue(new Response(blobAttendu, { status: 200 }));

    const resultat = await apiFetchBlob('/commandes/1/ticket/pdf', { token: 'abc123' });

    expect(resultat).toBeInstanceOf(Blob);
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('lève une ApiError avec le message Nest sur une réponse en erreur', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponseJson({ statusCode: 404, message: 'Commande introuvable', error: 'Not Found' }, 404),
    );

    await expect(apiFetchBlob('/commandes/x/ticket/pdf')).rejects.toMatchObject(
      new ApiError(404, 'Commande introuvable'),
    );
  });
});
