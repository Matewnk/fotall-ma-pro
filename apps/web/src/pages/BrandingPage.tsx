import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TenantSettings } from '../lib/types';

type Formulaire = {
  nomPressing: string;
  adresse: string;
  telephone: string;
  logoUrl: string;
  langue: string;
  devise: string;
  fuseauHoraire: string;
};

function versFormulaire(tenant: TenantSettings): Formulaire {
  return {
    nomPressing: tenant.nomPressing,
    adresse: tenant.adresse ?? '',
    telephone: tenant.telephone ?? '',
    logoUrl: tenant.logoUrl ?? '',
    langue: tenant.langue,
    devise: tenant.devise,
    fuseauHoraire: tenant.fuseauHoraire,
  };
}

// Écran §015-web tranche 6 (branding) — maquette de référence :
// docs/design/screens/personnalisation_du_branding. Nouveau backend
// nécessaire (GET/PATCH /tenant, aucun n'existait). Email de contact,
// upload de logo et couleur d'accent de la maquette non repris : aucun
// champ correspondant sur Tenant, et aucun backend de stockage de
// fichiers n'existe dans ce projet (voir docs/production-checklist.md).
// logoUrl reste une simple URL texte.
export function BrandingPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

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
          ...(formulaire.logoUrl ? { logoUrl: formulaire.logoUrl } : {}),
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setSucces(false);
    enregistrer.mutate();
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
          <label className="flex flex-col gap-1 text-sm">
            Logo (URL)
            <input
              type="url"
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={formulaire.logoUrl}
              onChange={(event) => setFormulaire((f) => f && { ...f, logoUrl: event.target.value })}
            />
          </label>
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
