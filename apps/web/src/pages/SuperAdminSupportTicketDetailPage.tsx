import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { StatutTicketSupport, TicketSupportGlobalDetail } from '../lib/types';

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

// Écran §022-super-admin-enhancement — détail d'un ticket côté Super-Admin :
// répondre et changer le statut. Un ticket RESOLU ne peut pas être rouvert
// directement (403 déjà appliqué côté API, support-tickets.service.ts) —
// les boutons EN_COURS/OUVERT sont donc masqués une fois résolu plutôt que
// de laisser cliquer sur une action qui échouera systématiquement.
export function SuperAdminSupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const ticket = useQuery({
    queryKey: ['super-admin-support-ticket', id],
    queryFn: () =>
      apiFetch<TicketSupportGlobalDetail>(`/super-admin/support-tickets/${id}`, { token }),
    enabled: Boolean(id),
  });

  function invalider() {
    queryClient.invalidateQueries({ queryKey: ['super-admin-support-ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-support-tickets'] });
  }

  const envoyer = useMutation({
    mutationFn: () =>
      apiFetch(`/super-admin/support-tickets/${id}/messages`, {
        method: 'POST',
        token,
        body: { corps: message },
      }),
    onSuccess: () => {
      invalider();
      setMessage('');
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Envoi impossible.'),
  });

  const changerStatut = useMutation({
    mutationFn: (statut: StatutTicketSupport) =>
      apiFetch(`/super-admin/support-tickets/${id}/statut`, {
        method: 'PATCH',
        token,
        body: { statut },
      }),
    onSuccess: invalider,
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Changement impossible.'),
  });

  function handleEnvoyer(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    envoyer.mutate();
  }

  if (ticket.isPending) {
    return <p className="text-sm text-on-surface-variant">Chargement…</p>;
  }
  if (!ticket.data) {
    return <p className="text-sm text-error">Ticket introuvable.</p>;
  }

  const boutonClasse =
    'rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-on-background">{ticket.data.sujet}</h1>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[ticket.data.statut]}`}
          >
            {LIBELLES_STATUT[ticket.data.statut]}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1">
          {ticket.data.tenant.nomPressing} — priorité {LIBELLES_PRIORITE[ticket.data.priorite]} —
          ouvert le {new Date(ticket.data.createdAt).toLocaleString('fr-FR')}
        </p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      {ticket.data.statut !== 'RESOLU' && (
        <div className="flex gap-2">
          {ticket.data.statut === 'OUVERT' && (
            <button
              type="button"
              className={boutonClasse}
              disabled={changerStatut.isPending}
              onClick={() => changerStatut.mutate('EN_COURS')}
            >
              Marquer en cours
            </button>
          )}
          <button
            type="button"
            className={boutonClasse}
            disabled={changerStatut.isPending}
            onClick={() => changerStatut.mutate('RESOLU')}
          >
            Marquer résolu
          </button>
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl p-4">
        <p className="text-sm text-on-surface whitespace-pre-wrap">{ticket.data.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {ticket.data.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 max-w-[85%] ${
              msg.auteurType === 'SUPER_ADMIN'
                ? 'bg-secondary-container text-on-secondary-container self-end'
                : 'bg-surface-container-high self-start'
            }`}
          >
            <p className="text-xs opacity-70 mb-1">
              {msg.auteurType === 'SUPER_ADMIN' ? 'Vous' : ticket.data.tenant.nomPressing} —{' '}
              {new Date(msg.createdAt).toLocaleString('fr-FR')}
            </p>
            <p className="text-sm whitespace-pre-wrap">{msg.corps}</p>
          </div>
        ))}
        {ticket.data.messages.length === 0 && (
          <p className="text-sm text-on-surface-variant">Aucune réponse pour l'instant.</p>
        )}
      </div>

      <form onSubmit={handleEnvoyer} className="flex flex-col gap-2">
        <textarea
          className="border border-outline-variant rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder="Répondre au tenant…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={envoyer.isPending}
          className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {envoyer.isPending ? 'Envoi…' : 'Répondre'}
        </button>
      </form>
    </div>
  );
}
