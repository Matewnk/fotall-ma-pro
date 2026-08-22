import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Client, Commande, ModeLivraison, Service } from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function OrdersPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const commandes = useQuery({
    queryKey: ['commandes'],
    queryFn: () => apiFetch<Commande[]>('/commandes', { token }),
  });
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiFetch<Client[]>('/clients', { token }),
  });
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });

  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>('RETRAIT');
  const [erreur, setErreur] = useState<string | null>(null);

  const creerCommande = useMutation({
    mutationFn: () =>
      apiFetch<Commande>('/commandes', {
        method: 'POST',
        token,
        body: {
          clientId,
          articles: [{ serviceId, quantite }],
          modeLivraison,
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setFormulaireOuvert(false);
      setClientId('');
      setServiceId('');
      setQuantite(1);
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    creerCommande.mutate();
  }

  const encaisserCommande = useMutation({
    mutationFn: (commande: Commande) =>
      apiFetch('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type: 'ENCAISSEMENT',
          montant: Number(commande.total),
          commandeId: commande.id,
          // Déterministe (pas crypto.randomUUID()) : un second clic sur
          // "Encaisser" pour la même commande ne doit jamais dupliquer
          // l'encaissement (rejeu idempotent, cash.service.ts).
          idempotencyKey: `encaissement-${commande.id}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-solde'] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-background">Commandes</h1>
        <button
          type="button"
          onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle commande
        </button>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Client
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {clients.data?.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Service
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {services.data?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.intitule} ({service.tarif})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Quantité
              <input
                type="number"
                min={1}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={quantite}
                onChange={(event) => setQuantite(Number(event.target.value))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mode
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={modeLivraison}
                onChange={(event) => setModeLivraison(event.target.value as ModeLivraison)}
              >
                <option value="RETRAIT">Retrait</option>
                <option value="LIVRAISON">Livraison</option>
              </select>
            </label>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={creerCommande.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {creerCommande.isPending ? 'Création…' : 'Créer la commande'}
          </button>
        </form>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Numéro</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {commandes.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Chargement…
                </td>
              </tr>
            )}
            {commandes.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Aucune commande pour l'instant.
                </td>
              </tr>
            )}
            {commandes.data?.map((commande) => (
              <tr key={commande.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-mono">#{commande.numero}</td>
                <td className="px-4 py-2">{commande.total} FCFA</td>
                <td className="px-4 py-2">{commande.modeLivraison}</td>
                <td className="px-4 py-2">
                  <StatusBadge statut={commande.statut} />
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => encaisserCommande.mutate(commande)}
                    disabled={encaisserCommande.isPending}
                    className="text-primary text-xs font-medium disabled:opacity-60"
                  >
                    Encaisser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
