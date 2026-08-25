import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, apiFetch, apiUpload } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TenantSettings } from '../lib/types';

type Formulaire = {
  nomPressing: string;
  adresse: string;
  telephone: string;
  langue: string;
  devise: string;
  fuseauHoraire: string;
};

function versFormulaire(tenant: TenantSettings): Formulaire {
  return {
    nomPressing: tenant.nomPressing,
    adresse: tenant.adresse ?? '',
    telephone: tenant.telephone ?? '',
    langue: tenant.langue,
    devise: tenant.devise,
    fuseauHoraire: tenant.fuseauHoraire,
  };
}

const TAILLE_MAX_LOGO_OCTETS = 2 * 1024 * 1024;

// Écran §015-web tranche 6 (branding) — maquette de référence :
// docs/design/screens/personnalisation_du_branding. Upload de logo
// (POST /tenant/logo, multipart) : stockage disque local côté serveur,
// voir tenant-settings/logo-storage.service.ts — un fichier par tenant,
// nommé d'après le tenantId du JWT (jamais un nom fourni par le client).
export function BrandingPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  const tenant = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/tenant', { token }),
  });

  useEffect(() => {
    if (tenant.data && !formulaire) {
      setFormulaire(versFormulaire(tenant.data));
    }
  }, [tenant.data, formulaire]);

  const enregistrer = useMutation({
    mutationFn: () => {
      if (!formulaire) throw new Error('formulaire non initialisé');
      return apiFetch<TenantSettings>('/tenant', {
        method: 'PATCH',
        token,
        body: {
          nomPressing: formulaire.nomPressing,
          langue: formulaire.langue,
          devise: formulaire.devise,
          fuseauHoraire: formulaire.fuseauHoraire,
          ...(formulaire.adresse ? { adresse: formulaire.adresse } : {}),
          ...(formulaire.telephone ? { telephone: formulaire.telephone } : {}),
        },
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tenant-settings'], data);
      setSucces(true);
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
      setSucces(false);
    },
  });

  const uploaderLogo = useMutation({
    mutationFn: (fichier: File) => {
      const formData = new FormData();
      formData.append('logo', fichier);
      return apiUpload<TenantSettings>('/tenant/logo', formData, { token });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tenant-settings'], data);
      setErreurLogo(null);
    },
    onError: (error) => {
      setErreurLogo(error instanceof ApiError ? error.message : 'Envoi du logo impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setSucces(false);
    enregistrer.mutate();
  }

  function handleChoisirLogo(event: ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    event.target.value = '';
    if (!fichier) return;
    setErreurLogo(null);
    if (fichier.size > TAILLE_MAX_LOGO_OCTETS) {
      setErreurLogo('Fichier trop volumineux (2 Mo maximum).');
      return;
    }
    uploaderLogo.mutate(fichier);
  }

  if (!formulaire) {
    return <p className="text-sm text-on-surface-variant">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Branding</h1>
        <p className="text-sm text-on-surface-variant">
          Ces informations apparaissent sur les tickets et communications clients.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Nom de l'établissement
          <input
            className="border border-outline-variant rounded-lg px-3 py-2"
            value={formulaire.nomPressing}
            onChange={(event) =>
              setFormulaire((f) => f && { ...f, nomPressing: event.target.value })
            }
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Adresse
          <input
            className="border border-outline-variant rounded-lg px-3 py-2"
            value={formulaire.adresse}
            onChange={(event) => setFormulaire((f) => f && { ...f, adresse: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Téléphone
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={formulaire.telephone}
              onChange={(event) =>
                setFormulaire((f) => f && { ...f, telephone: event.target.value })
              }
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Logo
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-outline-variant bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0">
                {tenant.data?.logoUrl ? (
                  <img
                    src={tenant.data.logoUrl}
                    alt="Logo du pressing"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant">image</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <input
                  ref={inputLogoRef}
                  type="file"
                  aria-label="Logo"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleChoisirLogo}
                />
                <button
                  type="button"
                  onClick={() => inputLogoRef.current?.click()}
                  disabled={uploaderLogo.isPending}
                  className="self-start border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-surface-container-high disabled:opacity-60"
                >
                  {uploaderLogo.isPending ? 'Envoi…' : 'Choisir un logo'}
                </button>
                <span className="text-xs text-on-surface-variant">PNG, JPG ou WEBP, 2 Mo max.</span>
              </div>
            </div>
            {erreurLogo && <p className="text-sm text-error">{erreurLogo}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Langue
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={formulaire.langue}
              onChange={(event) => setFormulaire((f) => f && { ...f, langue: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Devise
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={formulaire.devise}
              onChange={(event) => setFormulaire((f) => f && { ...f, devise: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fuseau horaire
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={formulaire.fuseauHoraire}
              onChange={(event) =>
                setFormulaire((f) => f && { ...f, fuseauHoraire: event.target.value })
              }
            />
          </label>
        </div>

        {erreur && <p className="text-sm text-error">{erreur}</p>}
        {succes && <p className="text-sm text-status-delivered">Enregistré.</p>}

        <button
          type="submit"
          disabled={enregistrer.isPending}
          className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
