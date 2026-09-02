import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { DefinitionPlan, PlanCommercial } from '../lib/types';

const LIBELLES_PLAN: Record<PlanCommercial, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

type FormulairePlan = {
  prixMensuel: string;
  devise: string;
  limiteUtilisateurs: string;
  limitePointsDeService: string;
  fonctionnalites: string;
};

function formulaireDepuis(definition: DefinitionPlan): FormulairePlan {
  return {
    prixMensuel: definition.prixMensuel !== null ? String(definition.prixMensuel) : '',
    devise: definition.devise,
    limiteUtilisateurs:
      definition.limiteUtilisateurs !== null ? String(definition.limiteUtilisateurs) : '',
    limitePointsDeService:
      definition.limitePointsDeService !== null ? String(definition.limitePointsDeService) : '',
    fonctionnalites: definition.fonctionnalites.join(', '),
  };
}

function formaterMontant(montant: number, devise: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} ${devise}`;
}

// Écran §022-super-admin-enhancement — catalogue de référence des plans
// commerciaux (Starter/Pro/Business, seules valeurs réellement présentes
// dans PlanCommercial). Chaque plan démarre "Non configuré" : aucun prix ni
// limite n'est inventé — le SUPER_ADMIN les renseigne lui-même via
// PUT /super-admin/plans/:plan. "Tenants sur ce plan" est calculé en direct
// depuis les tenants réels (Tenant.plan), jamais un chiffre statique.
export function SuperAdminPlansPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [planEnEdition, setPlanEnEdition] = useState<PlanCommercial | null>(null);
  const [formulaire, setFormulaire] = useState<FormulairePlan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: () => apiFetch<DefinitionPlan[]>('/super-admin/plans', { token }),
  });

  const enregistrer = useMutation({
    mutationFn: (plan: PlanCommercial) => {
      if (!formulaire) {
        return Promise.reject(new Error('Formulaire vide.'));
      }
      return apiFetch<DefinitionPlan>(`/super-admin/plans/${plan}`, {
        method: 'PUT',
        token,
        body: {
          ...(formulaire.prixMensuel ? { prixMensuel: Number(formulaire.prixMensuel) } : {}),
          ...(formulaire.devise ? { devise: formulaire.devise } : {}),
          ...(formulaire.limiteUtilisateurs
            ? { limiteUtilisateurs: Number(formulaire.limiteUtilisateurs) }
            : {}),
          ...(formulaire.limitePointsDeService
            ? { limitePointsDeService: Number(formulaire.limitePointsDeService) }
            : {}),
          fonctionnalites: formulaire.fonctionnalites
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      setPlanEnEdition(null);
      setFormulaire(null);
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.'),
  });

  function ouvrirEdition(definition: DefinitionPlan) {
    setPlanEnEdition(definition.plan);
    setFormulaire(formulaireDepuis(definition));
    setErreur(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Plans</h1>
        <p className="text-sm text-on-surface-variant">
          Catalogue de référence — prix, limites et fonctionnalités par plan.
        </p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      {plans.isPending && <p className="text-on-surface-variant">Chargement…</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.data?.map((definition) => {
          const enEdition = planEnEdition === definition.plan;
          return (
            <div
              key={definition.plan}
              className="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-on-background">
                  {LIBELLES_PLAN[definition.plan]}
                </h2>
                <span className="text-xs text-on-surface-variant">
                  {definition.nombreTenants} tenant(s)
                </span>
              </div>

              {!enEdition && (
                <>
                  <p className="text-2xl font-bold text-on-background">
                    {definition.prixMensuel !== null
                      ? `${formaterMontant(definition.prixMensuel, definition.devise)} / mois`
                      : 'Non configuré'}
                  </p>
                  <dl className="text-sm text-on-surface-variant flex flex-col gap-1">
                    <div className="flex justify-between">
                      <dt>Utilisateurs max</dt>
                      <dd>{definition.limiteUtilisateurs ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Points de service max</dt>
                      <dd>{definition.limitePointsDeService ?? '—'}</dd>
                    </div>
                  </dl>
                  {definition.fonctionnalites.length > 0 && (
                    <ul className="text-sm text-on-surface flex flex-col gap-1">
                      {definition.fonctionnalites.map((fonctionnalite) => (
                        <li key={fonctionnalite} className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-status-ready text-base">
                            check
                          </span>
                          {fonctionnalite}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(definition)}
                    className="mt-auto self-start rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
                  >
                    Modifier
                  </button>
                </>
              )}

              {enEdition && formulaire && (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Prix mensuel
                    <input
                      type="number"
                      min={0}
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={formulaire.prixMensuel}
                      onChange={(event) =>
                        setFormulaire((f) => (f ? { ...f, prixMensuel: event.target.value } : f))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Devise
                    <input
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={formulaire.devise}
                      onChange={(event) =>
                        setFormulaire((f) => (f ? { ...f, devise: event.target.value } : f))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Utilisateurs max
                    <input
                      type="number"
                      min={0}
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={formulaire.limiteUtilisateurs}
                      onChange={(event) =>
                        setFormulaire((f) =>
                          f ? { ...f, limiteUtilisateurs: event.target.value } : f,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Points de service max
                    <input
                      type="number"
                      min={0}
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={formulaire.limitePointsDeService}
                      onChange={(event) =>
                        setFormulaire((f) =>
                          f ? { ...f, limitePointsDeService: event.target.value } : f,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Fonctionnalités (séparées par une virgule)
                    <input
                      className="border border-outline-variant rounded-lg px-3 py-2"
                      value={formulaire.fonctionnalites}
                      onChange={(event) =>
                        setFormulaire((f) =>
                          f ? { ...f, fonctionnalites: event.target.value } : f,
                        )
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={enregistrer.isPending}
                      onClick={() => enregistrer.mutate(definition.plan)}
                      className="rounded-lg bg-primary text-on-primary px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlanEnEdition(null);
                        setFormulaire(null);
                      }}
                      className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
