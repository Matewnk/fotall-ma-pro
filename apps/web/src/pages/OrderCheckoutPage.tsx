import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiFetch, apiFetchBlob } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { ouvrirBlobDansNouvelOnglet } from '../lib/download';
import type { Client, Commande, ModePaiement, OperationCaisse, Service } from '../lib/types';

// Écran §order-to-cash (web) — maquette de référence :
// docs/design/screens/encaissement_commande_web. Le total affiché vient
// TOUJOURS de la commande (décision #5) : le caissier ne saisit jamais le
// total, seulement le montant reçu (décision #6). Le serveur recalcule et
// valide tout (décisions #4/#7/#8) — cet écran n'est qu'une présentation.
export function OrderCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const commande = useQuery({
    queryKey: ['commande', id],
    queryFn: () => apiFetch<Commande>(`/commandes/${id}`, { token }),
    enabled: !!id,
  });
  const client = useQuery({
    queryKey: ['client', commande.data?.clientId],
    queryFn: () => apiFetch<Client>(`/clients/${commande.data?.clientId}`, { token }),
    enabled: !!commande.data?.clientId,
  });
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });
  const servicesParId = new Map(services.data?.map((service) => [service.id, service]));

  // Indication d'affichage uniquement (déjà-encaissée) : la garantie réelle
  // contre le double encaissement est côté serveur (409, cash.service.ts),
  // pas cette requête.
  const operations = useQuery({
    queryKey: ['caisse-operations', 'ENCAISSEMENT'],
    queryFn: () => apiFetch<OperationCaisse[]>('/caisse/operations?type=ENCAISSEMENT', { token }),
  });
  const dejaEncaissee = useMemo(
    () => operations.data?.some((operation) => operation.commandeId === id) ?? false,
    [operations.data, id],
  );

  const [montantRecu, setMontantRecu] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('ESPECES');
  const [erreur, setErreur] = useState<string | null>(null);

  const total = commande.data ? Number(commande.data.total) : 0;
  const montantRecuNombre = Number(montantRecu || 0);
  const monnaie = montantRecu ? montantRecuNombre - total : null;

  const encaisser = useMutation({
    mutationFn: () =>
      apiFetch<OperationCaisse & { monnaie?: string }>('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type: 'ENCAISSEMENT',
          commandeId: id,
          montantRecu: montantRecuNombre,
          modePaiement,
          // Déterministe : un rejeu réseau du même clic ne duplique jamais
          // l'écriture (idempotence, cash.service.ts).
          idempotencyKey: `encaissement-${id}`,
        },
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-solde'] });
      setErreur(null);
      // Ouvre directement le ticket (PDF, QR code) de la commande encaissée
      // — le caissier n'a pas à retourner sur l'écran Tickets pour le
      // récupérer. Un échec de génération ne doit jamais bloquer le
      // retour à la liste : l'encaissement, lui, a déjà réussi.
      try {
        const blob = await apiFetchBlob(`/commandes/${id}/ticket/pdf`, { token });
        ouvrirBlobDansNouvelOnglet(blob);
      } catch {
        // Ticket non ouvert, mais l'encaissement reste acquis.
      }
      navigate('/commandes');
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Encaissement impossible.');
    },
  });

  function handleSubmit() {
    setErreur(null);
    if (montantRecuNombre < total) {
      setErreur(`Montant reçu insuffisant : ${total} FCFA dus.`);
      return;
    }
    encaisser.mutate();
  }

  if (commande.isPending) {
    return <p className="text-on-surface-variant">Chargement…</p>;
  }
  if (commande.isError || !commande.data) {
    return <p className="text-error">Commande introuvable.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link
          to="/commandes"
          className="p-2 hover:bg-surface-container rounded-full text-secondary transition-colors"
          aria-label="Retour aux commandes"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-2xl font-bold text-primary">
          Commande <span className="font-mono font-medium ml-2">#{commande.data.numero}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                {client.data?.nom.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <h2 className="font-bold text-on-surface">{client.data?.nom ?? '—'}</h2>
                <p className="text-sm text-secondary">{client.data?.telephone}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-ticket border border-outline-variant rounded-xl p-6 flex flex-col">
            <h3 className="text-xs uppercase font-semibold text-secondary mb-4 border-b border-dashed border-outline pb-2">
              Récapitulatif de commande
            </h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dashed border-outline text-secondary text-sm">
                  <th className="pb-2 font-normal">Article</th>
                  <th className="pb-2 font-normal text-right">Qté</th>
                  <th className="pb-2 font-normal text-right">Prix (FCFA)</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                {commande.data.articles?.map((article) => (
                  <tr
                    key={article.id}
                    className="border-b border-dashed border-outline-variant/50 h-10"
                  >
                    <td>{servicesParId.get(article.serviceId)?.intitule ?? article.serviceId}</td>
                    <td className="text-right">x{article.quantite}</td>
                    <td className="text-right">{article.sousTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 bg-primary text-on-primary rounded-lg p-6 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wide">Total à encaisser</span>
              <span className="font-mono text-3xl font-bold">
                {commande.data.total} <span className="text-lg">FCFA</span>
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-6">
          <h3 className="font-bold text-on-surface border-b border-outline-variant pb-4">
            Paiement
          </h3>

          {dejaEncaissee ? (
            <p className="text-status-ready font-medium flex items-center gap-2">
              <span className="material-symbols-outlined">check_circle</span>
              Cette commande est déjà encaissée.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Montant reçu (FCFA)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="border-2 border-outline-variant focus:border-primary rounded-lg px-4 py-3 text-right font-mono text-2xl"
                  value={montantRecu}
                  onChange={(event) => setMontantRecu(event.target.value)}
                  required
                />
              </label>

              <div className="bg-surface p-4 rounded-lg border border-outline-variant flex items-center justify-between">
                <span className="text-sm text-secondary font-medium">Monnaie :</span>
                <span
                  className={`font-mono text-xl font-bold ${
                    monnaie !== null && monnaie < 0 ? 'text-error' : 'text-status-ready'
                  }`}
                >
                  {monnaie !== null ? `${monnaie.toLocaleString('fr-FR')} FCFA` : '—'}
                </span>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                Méthode de paiement
                <select
                  className="border border-outline-variant rounded-lg px-3 py-2"
                  value={modePaiement}
                  onChange={(event) => setModePaiement(event.target.value as ModePaiement)}
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="CARTE">Carte</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="WAVE">Wave</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="DJAMON">Djamon</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </label>

              {erreur && <p className="text-sm text-error">{erreur}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={encaisser.isPending || !montantRecu}
                className="mt-auto w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined">check_circle</span>
                {encaisser.isPending ? 'Encaissement…' : 'ENCAISSER LA COMMANDE'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
