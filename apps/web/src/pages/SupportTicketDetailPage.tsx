import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TicketSupportDetail } from '../lib/types';

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

export function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const ticket = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => apiFetch<TicketSupportDetail>(`/support-tickets/${id}`, { token }),
    enabled: Boolean(id),
  });

  const envoyer = useMutation({
    mutationFn: () =>
      apiFetch(`/support-tickets/${id}/messages`, {
        method: 'POST',
        token,
        body: { corps: message },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      setMessage('');
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Envoi impossible.'),
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-on-background">{ticket.data.sujet}</h1>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[ticket.data.statut]}`}
          >
            {LIBELLES_STATUT[ticket.data.statut]}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1">
          Ouvert le {new Date(ticket.data.createdAt).toLocaleString('fr-FR')}
        </p>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl p-4">
        <p className="text-sm text-on-surface whitespace-pre-wrap">{ticket.data.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {ticket.data.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 max-w-[85%] ${
              msg.auteurType === 'SUPER_ADMIN'
                ? 'bg-secondary-container text-on-secondary-container self-start'
                : 'bg-surface-container-high self-end'
            }`}
          >
            <p className="text-xs opacity-70 mb-1">
              {msg.auteurType === 'SUPER_ADMIN' ? 'Équipe Fotall-Ma Pro' : 'Vous'} —{' '}
              {new Date(msg.createdAt).toLocaleString('fr-FR')}
            </p>
            <p className="text-sm whitespace-pre-wrap">{msg.corps}</p>
          </div>
        ))}
        {ticket.data.messages.length === 0 && (
          <p className="text-sm text-on-surface-variant">Aucune réponse pour l'instant.</p>
        )}
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      <form onSubmit={handleEnvoyer} className="flex flex-col gap-2">
        <textarea
          className="border border-outline-variant rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder="Écrire une réponse…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={envoyer.isPending}
          className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {envoyer.isPending ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
