import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { Commande, ModePaiement, OperationCaisse, TypeOperationCaisse } from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

const LIBELLES_TYPE: Record<TypeOperationCaisse, string> = {
  OUVERTURE: 'Ouverture',
  ENCAISSEMENT: 'Encaissement',
  AVANCE: 'Avance',
  DEPENSE: 'Dépense',
  REMBOURSEMENT: 'Remboursement',
  AJUSTEMENT_COMPENSATOIRE: 'Ajustement',
  CLOTURE: 'Clôture',
};

// Écran §010 (caisse) — maquette de référence :
// docs/design/screens/journal_de_caisse_et_rapports_financiers. Le journal
// est append-only (Constitution IV) : aucune édition ni suppression
// d'opération n'est exposée côté API, donc aucune ici non plus — seule une
// nouvelle opération (éventuellement compensatoire) peut être enregistrée.
export function CashPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [type, setType] = useState<TypeOperationCaisse>('ENCAISSEMENT');
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement | ''>('');
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const solde = useQuery({
    queryKey: ['caisse-solde'],
    queryFn: () => apiFetch<{ solde: string }>('/caisse/solde', { token }),
  });
  const operations = useQuery({
    queryKey: ['caisse-operations'],
    queryFn: () => apiFetch<OperationCaisse[]>('/caisse/operations', { token }),
  });
  // Le journal renvoie commandeId (identifiant brut) : cette requête sert
  // uniquement à afficher le numéro de commande lisible en face de chaque
  // encaissement, pas à en modifier quoi que ce soit.
  const commandes = useQuery({
    queryKey: ['commandes'],
    queryFn: () => apiFetch<Commande[]>('/commandes', { token }),
  });
  const numeroParCommandeId = new Map(commandes.data?.map((c) => [c.id, c.numero]));

  const enregistrerOperation = useMutation({
    mutationFn: () =>
      apiFetch<OperationCaisse>('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type,
          montant: Number(montant),
          ...(modePaiement ? { modePaiement } : {}),
          ...(reference ? { reference } : {}),
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-solde'] });
      setFormulaireOuvert(false);
      setMontant('');
      setModePaiement('');
      setReference('');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    enregistrerOperation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-background">Journal de caisse</h1>
        <button
          type="button"
          onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle opération
        </button>
      </div>

      <div className="bg-primary text-on-primary rounded-xl p-4 max-w-xs">
        <p className="text-xs uppercase opacity-80">Solde en caisse</p>
        <p className="text-2xl font-bold">{solde.data?.solde ?? '—'} FCFA</p>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={type}
                onChange={(event) => setType(event.target.value as TypeOperationCaisse)}
              >
                {Object.entries(LIBELLES_TYPE).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Montant
              <input
                type="number"
                min={0}
                step="0.01"
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={montant}
                onChange={(event) => setMontant(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mode
              <select
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={modePaiement}
                onChange={(event) => setModePaiement(event.target.value as ModePaiement | '')}
              >
                <option value="">—</option>
                <option value="ESPECES">Espèces</option>
                <option value="CARTE">Carte</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="AUTRE">Autre</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Référence
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={enregistrerOperation.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {enregistrerOperation.isPending ? 'Enregistrement…' : "Enregistrer l'opération"}
          </button>
        </form>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Heure</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Montant</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Commande</th>
              <th className="px-4 py-2">Référence</th>
            </tr>
          </thead>
          <tbody>
            {operations.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Chargement…
                </td>
              </tr>
            )}
            {operations.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Aucune opération pour l'instant.
                </td>
              </tr>
            )}
            {operations.data?.map((operation) => (
              <tr key={operation.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-mono text-xs">
                  {new Date(operation.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-2">{LIBELLES_TYPE[operation.type]}</td>
                <td className="px-4 py-2">{operation.montant} FCFA</td>
                <td className="px-4 py-2">{operation.modePaiement ?? '—'}</td>
                <td className="px-4 py-2 font-mono">
                  {operation.commandeId && numeroParCommandeId.has(operation.commandeId)
                    ? `#${numeroParCommandeId.get(operation.commandeId)}`
                    : '—'}
                </td>
                <td className="px-4 py-2">{operation.reference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
