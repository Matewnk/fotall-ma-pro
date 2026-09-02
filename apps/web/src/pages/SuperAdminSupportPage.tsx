import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TicketSupportGlobal } from '../lib/types';

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

const COULEURS_PRIORITE: Record<string, string> = {
  BASSE: 'text-on-surface-variant',
  NORMALE: 'text-on-surface-variant',
  HAUTE: 'text-status-pending',
  URGENTE: 'text-error font-semibold',
};

// Écran §022-super-admin-enhancement — centre de support, vue globale.
// GET /super-admin/support-tickets lit tous les tickets tous tenants
// confondus (control-plane), lecture seule ici — les réponses et le
// changement de statut se font sur la page détail par ticket.
export function SuperAdminSupportPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');

  const tickets = useQuery({
    queryKey: ['super-admin-support-tickets'],
    queryFn: () => apiFetch<TicketSupportGlobal[]>('/super-admin/support-tickets', { token }),
  });

  const ticketsAffiches = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLocaleLowerCase('fr-FR');
    return (tickets.data ?? []).filter((ticket) => {
      const correspondRecherche =
        rechercheNormalisee === '' ||
        ticket.sujet.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee) ||
        ticket.tenant.nomPressing.toLocaleLowerCase('fr-FR').includes(rechercheNormalisee);
      const correspondStatut = filtreStatut === '' || ticket.statut === filtreStatut;
      const correspondPriorite = filtrePriorite === '' || ticket.priorite === filtrePriorite;
      return correspondRecherche && correspondStatut && correspondPriorite;
    });
  }, [tickets.data, recherche, filtreStatut, filtrePriorite]);

  const nbOuverts = (tickets.data ?? []).filter((t) => t.statut !== 'RESOLU').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Support</h1>
        <p className="text-sm text-on-surface-variant">
          {nbOuverts} ticket(s) ouvert(s) ou en cours, tous tenants confondus.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="search"
            aria-label="Rechercher un ticket"
            placeholder="Rechercher (sujet, tenant)…"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            className="w-full border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Statut
          <select
            value={filtreStatut}
            onChange={(event) => setFiltreStatut(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            {Object.keys(LIBELLES_STATUT).map((statut) => (
              <option key={statut} value={statut}>
                {LIBELLES_STATUT[statut]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priorité
          <select
            value={filtrePriorite}
            onChange={(event) => setFiltrePriorite(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Toutes</option>
            {Object.keys(LIBELLES_PRIORITE).map((priorite) => (
              <option key={priorite} value={priorite}>
                {LIBELLES_PRIORITE[priorite]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Sujet</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Priorité</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Créé le</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Chargement…
                </td>
              </tr>
            )}
            {!tickets.isPending && ticketsAffiches.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={6}>
                  Aucun ticket ne correspond à la recherche.
                </td>
              </tr>
            )}
            {ticketsAffiches.map((ticket) => (
              <tr key={ticket.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium text-on-surface">{ticket.sujet}</td>
                <td className="px-4 py-2 text-on-surface-variant">{ticket.tenant.nomPressing}</td>
                <td className={`px-4 py-2 ${COULEURS_PRIORITE[ticket.priorite]}`}>
                  {LIBELLES_PRIORITE[ticket.priorite]}
                </td>
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
                  <Link
                    to={`/super-admin/support-tickets/${ticket.id}`}
                    className="text-primary text-xs font-medium"
                  >
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
