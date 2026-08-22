import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Client, Commande, ModeLivraison, Service } from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

type LigneArticle = { serviceId: string; quantite: number };

// Écran §order-to-cash (web) — maquette de référence :
// docs/design/screens/nouvelle_commande_calcul_auto_web. Le panier accepte
// plusieurs lignes de prestations (décision utilisateur #12, parité avec le
// mobile) ; le total affiché est indicatif uniquement — toujours recalculé
// côté serveur à la création (orders.service.ts). La création redirige vers
// l'écran d'encaissement dédié (décision #définition métier "objectif").
export function OrdersPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const servicesParId = new Map(services.data?.map((service) => [service.id, service]));

  const [clientId, setClientId] = useState('');
  const [serviceAAjouter, setServiceAAjouter] = useState('');
  const [quantiteAAjouter, setQuantiteAAjouter] = useState(1);
  const [panier, setPanier] = useState<LigneArticle[]>([]);
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>('RETRAIT');
  const [erreur, setErreur] = useState<string | null>(null);

  const totalPanier = panier.reduce((acc, ligne) => {
    const tarif = Number(servicesParId.get(ligne.serviceId)?.tarif ?? 0);
    return acc + tarif * ligne.quantite;
  }, 0);

  function ajouterAuPanier() {
    if (!serviceAAjouter) return;
    setPanier((lignes) => {
      const existante = lignes.find((ligne) => ligne.serviceId === serviceAAjouter);
      if (existante) {
        return lignes.map((ligne) =>
          ligne.serviceId === serviceAAjouter
            ? { ...ligne, quantite: ligne.quantite + quantiteAAjouter }
            : ligne,
        );
      }
      return [...lignes, { serviceId: serviceAAjouter, quantite: quantiteAAjouter }];
    });
    setServiceAAjouter('');
    setQuantiteAAjouter(1);
  }

  function modifierQuantite(serviceId: string, delta: number) {
    setPanier((lignes) =>
      lignes
        .map((ligne) =>
          ligne.serviceId === serviceId ? { ...ligne, quantite: ligne.quantite + delta } : ligne,
        )
        .filter((ligne) => ligne.quantite > 0),
    );
  }

  function retirerDuPanier(serviceId: string) {
    setPanier((lignes) => lignes.filter((ligne) => ligne.serviceId !== serviceId));
  }

  const creerCommande = useMutation({
    mutationFn: () =>
      apiFetch<Commande>('/commandes', {
        method: 'POST',
        token,
        body: {
          clientId,
          articles: panier.map(({ serviceId, quantite }) => ({ serviceId, quantite })),
          modeLivraison,
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: (commande) => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setFormulaireOuvert(false);
      setClientId('');
      setPanier([]);
      setErreur(null);
      navigate(`/commandes/${commande.id}/encaisser`);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    if (panier.length === 0) {
      setErreur('Ajoutez au moins une prestation au panier.');
      return;
    }
    creerCommande.mutate();
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
            <p className="text-xs uppercase font-semibold text-on-surface-variant">
              Ajouter une prestation
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <label className="flex flex-col gap-1 text-sm">
                Service
                <select
                  className="border border-outline-variant rounded-lg px-3 py-2"
                  value={serviceAAjouter}
                  onChange={(event) => setServiceAAjouter(event.target.value)}
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {services.data?.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.intitule} ({service.tarif} FCFA)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Quantité
                <input
                  type="number"
                  min={1}
                  className="border border-outline-variant rounded-lg px-3 py-2 w-24"
                  value={quantiteAAjouter}
                  onChange={(event) => setQuantiteAAjouter(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={ajouterAuPanier}
                disabled={!serviceAAjouter}
                className="bg-secondary-container text-on-secondary-container rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                Ajouter
              </button>
            </div>

            {panier.length > 0 && (
              <ul className="flex flex-col gap-2 mt-2">
                {panier.map((ligne) => {
                  const service = servicesParId.get(ligne.serviceId);
                  return (
                    <li
                      key={ligne.serviceId}
                      className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{service?.intitule ?? ligne.serviceId}</p>
                        <p className="text-xs text-on-surface-variant font-mono">
                          x {service?.tarif ?? '0'} FCFA
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-outline-variant rounded-full">
                          <button
                            type="button"
                            aria-label={`Diminuer ${service?.intitule ?? ''}`}
                            onClick={() => modifierQuantite(ligne.serviceId, -1)}
                            className="w-7 h-7 flex items-center justify-center text-secondary"
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="font-mono w-6 text-center text-sm">{ligne.quantite}</span>
                          <button
                            type="button"
                            aria-label={`Augmenter ${service?.intitule ?? ''}`}
                            onClick={() => modifierQuantite(ligne.serviceId, 1)}
                            className="w-7 h-7 flex items-center justify-center text-secondary"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                        <span className="font-mono text-sm font-semibold w-24 text-right">
                          {(Number(service?.tarif ?? 0) * ligne.quantite).toLocaleString('fr-FR')} FCFA
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${service?.intitule ?? ''}`}
                          onClick={() => retirerDuPanier(ligne.serviceId)}
                          className="text-outline hover:text-error"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-primary text-on-primary rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm uppercase font-semibold tracking-wide">Total à encaisser</span>
            <span className="font-mono text-2xl font-bold">
              {totalPanier.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={creerCommande.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-6 py-3 text-sm font-bold disabled:opacity-60 flex items-center gap-2"
          >
            <span className="material-symbols-outlined">point_of_sale</span>
            {creerCommande.isPending ? 'Création…' : 'VALIDER LA COMMANDE'}
          </button>
        </form>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
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
                  <Link
                    to={`/commandes/${commande.id}/encaisser`}
                    className="text-primary text-xs font-medium"
                  >
                    Encaisser
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
