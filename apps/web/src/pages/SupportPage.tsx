import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { PrioriteTicketSupport, TicketSupport } from '../lib/types';

const LIBELLES_STATUT: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
};

const COULEURS_STATUT: Record<string, string> = {
  OUVERT: 'bg-status-pending/10 text-status-pending',
  EN_COURS: 'bg-status-progress/10 text-status-progress',
  RESOLU: 'bg-status-ready/10 text-status-ready',
};

const LIBELLES_PRIORITE: Record<string, string> = {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
};

const PRIORITES: PrioriteTicketSupport[] = ['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'];

// Écran §022-super-admin-enhancement — support, côté tenant. Ouvert à tout
// le personnel (pas seulement ADMIN, voir support-tickets.controller.ts) :
// demander de l'aide n'est pas une action administrative. Les tickets créés
// ici alimentent /super-admin/support-tickets, jamais de donnée séparée.
export function SupportPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [sujet, setSujet] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<PrioriteTicketSupport>('NORMALE');
  const [erreur, setErreur] = useState<string | null>(null);

  const tickets = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => apiFetch<TicketSupport[]>('/support-tickets', { token }),
  });

  const creer = useMutation({
    mutationFn: () =>
      apiFetch<TicketSupport>('/support-tickets', {
        method: 'POST',
        token,
        body: { sujet, description, priorite },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setFormulaireOuvert(false);
      setSujet('');
      setDescription('');
      setPriorite('NORMALE');
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Création impossible.'),
  });

  function handleCreer(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    creer.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-background text-center sm:text-left">Support</h1>
          <p className="text-sm text-on-surface-variant">
            Une question, un problème ? Contactez l'équipe Fotall-Ma Pro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined">add</span>
          Nouveau ticket
        </button>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleCreer}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <label className="flex flex-col gap-1 text-sm">
            Sujet
            <input
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={sujet}
              onChange={(event) => setSujet(event.target.value)}
              required
              minLength={3}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea
              className="border border-outline-variant rounded-lg px-3 py-2"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={10}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm max-w-xs">
            Priorité
            <select
              className="border border-outline-variant rounded-lg px-3 py-2"
              value={priorite}
              onChange={(event) => setPriorite(event.target.value as PrioriteTicketSupport)}
            >
              {PRIORITES.map((p) => (
                <option key={p} value={p}>
                  {LIBELLES_PRIORITE[p]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={creer.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {creer.isPending ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Sujet</th>
              <th className="px-4 py-2">Priorité</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Créé le</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Chargement…
                </td>
              </tr>
            )}
            {!tickets.isPending && tickets.data?.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                  Aucun ticket pour l'instant.
                </td>
              </tr>
            )}
            {tickets.data?.map((ticket) => (
              <tr key={ticket.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium text-on-surface">{ticket.sujet}</td>
                <td className="px-4 py-2">{LIBELLES_PRIORITE[ticket.priorite]}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[ticket.statut]}`}
                  >
                    {LIBELLES_STATUT[ticket.statut]}
                  </span>
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <Link to={`/support/${ticket.id}`} className="text-primary text-xs font-medium">
                    Voir
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
