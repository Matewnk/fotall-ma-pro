import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { COULEUR_ICONE_PAR_DEFAUT, COULEUR_PAR_ICONE, ICONES_SERVICE } from '../lib/icones-service';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Service } from '../lib/types';

type FormulaireService = {
  code: string;
  intitule: string;
  categorie: string;
  delaiHeures: string;
  tarif: string;
  icone: string;
};

const FORMULAIRE_VIDE: FormulaireService = {
  code: '',
  intitule: '',
  categorie: '',
  delaiHeures: '',
  tarif: '',
  icone: '',
};

// Écran §008 (services/tarifs) — maquette de référence :
// docs/design/screens/configuration_des_tarifs_tenant_admin. Les KPI
// (services actifs/catégories) de la maquette sont dérivés de la liste
// réelle plutôt qu'un endpoint dédié inexistant.
export function ServicesPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [serviceEnEdition, setServiceEnEdition] = useState<Service | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireService>(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });

  const categories = new Set(services.data?.map((s) => s.categorie)).size;

  function ouvrirCreation() {
    setServiceEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(service: Service) {
    setServiceEnEdition(service);
    setFormulaire({
      code: service.code,
      intitule: service.intitule,
      categorie: service.categorie,
      delaiHeures: service.delaiHeures !== undefined ? String(service.delaiHeures) : '',
      tarif: service.tarif,
      icone: service.icone ?? '',
    });
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setServiceEnEdition(null);
  }

  const enregistrerService = useMutation({
    mutationFn: () => {
      const base = {
        intitule: formulaire.intitule,
        categorie: formulaire.categorie,
        tarif: Number(formulaire.tarif),
        ...(formulaire.delaiHeures ? { delaiHeures: Number(formulaire.delaiHeures) } : {}),
        ...(formulaire.icone ? { icone: formulaire.icone } : {}),
      };
      return serviceEnEdition
        ? apiFetch<Service>(`/services/${serviceEnEdition.id}`, {
            method: 'PATCH',
            token,
            body: base,
          })
        : apiFetch<Service>('/services', {
            method: 'POST',
            token,
            body: { ...base, code: formulaire.code },
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      fermerFormulaire();
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  const supprimerService = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/services/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    enregistrerService.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-on-background">Tarifs &amp; services</h1>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">add</span>
          Ajouter un service
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs text-on-surface-variant uppercase">Services actifs</p>
          <p className="text-2xl font-bold text-on-background">
            {services.data?.filter((s) => s.actif).length ?? 0}
          </p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <p className="text-xs text-on-surface-variant uppercase">Catégories</p>
          <p className="text-2xl font-bold text-on-background">{categories}</p>
        </div>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!serviceEnEdition && (
              <label className="flex flex-col gap-1 text-sm">
                Code
                <input
                  className="border border-outline-variant rounded-lg px-3 py-2"
                  placeholder="SRV-01"
                  value={formulaire.code}
                  onChange={(event) => setFormulaire((f) => ({ ...f, code: event.target.value }))}
                  required
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Intitulé
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.intitule}
                onChange={(event) => setFormulaire((f) => ({ ...f, intitule: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Catégorie
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.categorie}
                onChange={(event) =>
                  setFormulaire((f) => ({ ...f, categorie: event.target.value }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Délai (heures)
              <input
                type="number"
                min={0}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.delaiHeures}
                onChange={(event) =>
                  setFormulaire((f) => ({ ...f, delaiHeures: event.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tarif (FCFA)
              <input
                type="number"
                min={0}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.tarif}
                onChange={(event) => setFormulaire((f) => ({ ...f, tarif: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm">Icône</span>
            <div className="flex flex-wrap gap-2">
              {ICONES_SERVICE.map(({ valeur, libelle, couleur }) => {
                const selectionne = formulaire.icone === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    title={libelle}
                    aria-label={libelle}
                    aria-pressed={selectionne}
                    onClick={() =>
                      setFormulaire((f) => ({ ...f, icone: f.icone === valeur ? '' : valeur }))
                    }
                    style={
                      selectionne
                        ? { backgroundColor: couleur, borderColor: couleur }
                        : { borderColor: `${couleur}55` }
                    }
                    className="w-10 h-10 flex items-center justify-center rounded-lg border transition-colors"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: selectionne ? '#ffffff' : couleur }}
                    >
                      {valeur}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={enregistrerService.isPending}
              className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {enregistrerService.isPending
                ? 'Enregistrement…'
                : serviceEnEdition
                  ? 'Mettre à jour'
                  : 'Créer le service'}
            </button>
            <button
              type="button"
              onClick={fermerFormulaire}
              className="self-start rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Catégorie</th>
              <th className="px-4 py-2">Tarif</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Chargement…
                </td>
              </tr>
            )}
            {services.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Aucun service pour l'instant.
                </td>
              </tr>
            )}
            {services.data?.map((service) => {
              const couleurIcone =
                COULEUR_PAR_ICONE.get(service.icone ?? '') ?? COULEUR_ICONE_PAR_DEFAUT;
              return (
                <tr key={service.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
                        style={{ backgroundColor: `${couleurIcone}1A` }}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={{ color: couleurIcone }}
                        >
                          {service.icone ?? 'local_laundry_service'}
                        </span>
                      </span>
                      <div>
                        <div className="font-medium">{service.intitule}</div>
                        <div className="text-on-surface-variant text-xs font-mono">
                          {service.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">{service.categorie}</td>
                  <td className="px-4 py-2">{service.tarif} FCFA</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        service.actif
                          ? 'bg-status-delivered/10 text-status-delivered'
                          : 'bg-status-pending/10 text-status-pending'
                      }`}
                    >
                      {service.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(service)}
                        className="text-primary text-xs font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Supprimer ${service.intitule} ?`)) {
                            supprimerService.mutate(service.id);
                          }
                        }}
                        className="text-error text-xs font-medium"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
