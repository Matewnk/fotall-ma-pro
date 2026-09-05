import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CanalNotification, Client } from '../lib/types';

type FormulaireClient = {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  canalNotification: CanalNotification | '';
};

const FORMULAIRE_VIDE: FormulaireClient = {
  nom: '',
  telephone: '',
  email: '',
  adresse: '',
  canalNotification: '',
};

// Écran §007 (clients) — maquette de référence :
// docs/design/screens/gestion_des_clients_et_fid_lit. Fidélité/points/palier
// de la maquette ne sont pas repris : aucun champ correspondant côté API
// (adapté librement pour les données réelles, comme 015-web MVP).
export function ClientsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState('');
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [clientEnEdition, setClientEnEdition] = useState<Client | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireClient>(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ['clients', recherche],
    queryFn: () =>
      apiFetch<Client[]>(`/clients${recherche ? `?nom=${encodeURIComponent(recherche)}` : ''}`, {
        token,
      }),
  });

  function ouvrirCreation() {
    setClientEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(client: Client) {
    setClientEnEdition(client);
    setFormulaire({
      nom: client.nom,
      telephone: client.telephone,
      email: client.email ?? '',
      adresse: client.adresse ?? '',
      canalNotification: client.canalNotification ?? '',
    });
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setClientEnEdition(null);
  }

  const enregistrerClient = useMutation({
    mutationFn: () => {
      const corps = {
        nom: formulaire.nom,
        telephone: formulaire.telephone,
        ...(formulaire.email ? { email: formulaire.email } : {}),
        ...(formulaire.adresse ? { adresse: formulaire.adresse } : {}),
        ...(formulaire.canalNotification
          ? { canalNotification: formulaire.canalNotification }
          : {}),
      };
      return clientEnEdition
        ? apiFetch<Client>(`/clients/${clientEnEdition.id}`, {
            method: 'PATCH',
            token,
            body: corps,
          })
        : apiFetch<Client>('/clients', { method: 'POST', token, body: corps });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      fermerFormulaire();
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  const supprimerClient = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clients/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    enregistrerClient.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-background text-center sm:text-left">Clients</h1>
          <p className="text-sm text-on-surface-variant">
            {clients.data?.length ?? 0} client(s) enregistré(s)
          </p>
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">person_add</span>
          Nouveau client
        </button>
      </div>

      <input
        type="search"
        placeholder="Rechercher (nom)…"
        value={recherche}
        onChange={(event) => setRecherche(event.target.value)}
        className="border border-outline-variant rounded-lg px-3 py-2 text-sm max-w-sm"
      />

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Nom
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.nom}
                onChange={(event) => setFormulaire((f) => ({ ...f, nom: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Téléphone
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.telephone}
                onChange={(event) =>
                  setFormulaire((f) => ({ ...f, telephone: event.target.value }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.email}
                onChange={(event) => setFormulaire((f) => ({ ...f, email: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Adresse
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.adresse}
                onChange={(event) => setFormulaire((f) => ({ ...f, adresse: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Canal préféré
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.canalNotification}
                onChange={(event) =>
                  setFormulaire((f) => ({
                    ...f,
                    canalNotification: event.target.value as CanalNotification | '',
                  }))
                }
              >
                <option value="">—</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="PUSH">Push</option>
              </select>
            </label>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={enregistrerClient.isPending}
              className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {enregistrerClient.isPending
                ? 'Enregistrement…'
                : clientEnEdition
                  ? 'Mettre à jour'
                  : 'Créer le client'}
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
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Chargement…
                </td>
              </tr>
            )}
            {clients.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={4}>
                  Aucun client pour l'instant.
                </td>
              </tr>
            )}
            {clients.data?.map((client) => (
              <tr key={client.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium">{client.nom}</td>
                <td className="px-4 py-2">
                  <div>{client.telephone}</div>
                  {client.email && (
                    <div className="text-on-surface-variant text-xs">{client.email}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      client.statut === 'ACTIF'
                        ? 'bg-status-delivered/10 text-status-delivered'
                        : 'bg-status-pending/10 text-status-pending'
                    }`}
                  >
                    {client.statut === 'ACTIF' ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(client)}
                      className="text-primary text-xs font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer ${client.nom} ?`)) {
                          supprimerClient.mutate(client.id);
                        }
                      }}
                      className="text-error text-xs font-medium"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
