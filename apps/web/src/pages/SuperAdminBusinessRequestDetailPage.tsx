import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { DemandeBusiness, StatutDemandeBusiness } from '../lib/types';

const LIBELLES_STATUT: Record<StatutDemandeBusiness, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  TRAITE: 'Traitée',
  REJETE: 'Rejetée',
};

const COULEURS_STATUT: Record<StatutDemandeBusiness, string> = {
  NOUVEAU: 'bg-status-pending/10 text-status-pending',
  EN_COURS: 'bg-status-progress/10 text-status-progress',
  TRAITE: 'bg-status-ready/10 text-status-ready',
  REJETE: 'bg-error/10 text-error',
};

const LIBELLES_ACTIVITE: Record<string, string> = {
  PRESSING_BLANCHISSERIE: 'Pressing / Blanchisserie',
  LAVAGE_AUTO: 'Lavage auto',
  PRESSING_LAVAGE_AUTO: 'Pressing + Lavage auto',
  AUTRE: 'Autre',
};

const LIBELLES_TYPE_DEMANDE: Record<string, string> = {
  DEVIS: 'Demander un devis',
  INFORMATIONS: 'Demander des informations',
  DEMONSTRATION: 'Demander une démonstration',
  ACCOMPAGNEMENT: 'Demander un accompagnement',
  AUTRE: 'Autre',
};

// Détail d'une demande de contact Business — machine à états côté service
// (business-contact-requests.service.ts) : NOUVEAU -> EN_COURS -> TRAITE
// (terminal), NOUVEAU|EN_COURS -> REJETE (terminal). Les boutons d'une
// transition impossible depuis l'état courant sont désactivés plutôt que
// de laisser cliquer sur une action qui échouera systématiquement (même
// principe que SuperAdminSupportTicketDetailPage).
export function SuperAdminBusinessRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const demande = useQuery({
    queryKey: ['super-admin-business-request', id],
    queryFn: () => apiFetch<DemandeBusiness>(`/super-admin/demandes-business/${id}`, { token }),
    enabled: Boolean(id),
  });

  function invalider() {
    queryClient.invalidateQueries({ queryKey: ['super-admin-business-request', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-business-requests'] });
  }

  const changerStatut = useMutation({
    mutationFn: (statut: StatutDemandeBusiness) =>
      apiFetch(`/super-admin/demandes-business/${id}/statut`, {
        method: 'PATCH',
        token,
        body: { statut },
      }),
    onSuccess: () => {
      invalider();
      setErreur(null);
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Changement impossible.'),
  });

  if (demande.isPending) {
    return <p className="text-sm text-on-surface-variant">Chargement…</p>;
  }
  if (!demande.data) {
    return <p className="text-sm text-error">Demande introuvable.</p>;
  }

  const boutonClasse =
    'rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60';
  const peutPasserEnCours = demande.data.statut === 'NOUVEAU';
  const peutMarquerTraitee = demande.data.statut === 'EN_COURS';
  const peutRejeter = demande.data.statut === 'NOUVEAU' || demande.data.statut === 'EN_COURS';

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-on-background">Détail de la demande</h1>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[demande.data.statut]}`}
          >
            {LIBELLES_STATUT[demande.data.statut]}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1">
          Reçue le {new Date(demande.data.createdAt).toLocaleString('fr-FR')}
        </p>
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className={boutonClasse}
          disabled={!peutPasserEnCours || changerStatut.isPending}
          onClick={() => changerStatut.mutate('EN_COURS')}
        >
          Passer en cours
        </button>
        <button
          type="button"
          className={boutonClasse}
          disabled={!peutMarquerTraitee || changerStatut.isPending}
          onClick={() => changerStatut.mutate('TRAITE')}
        >
          Marquer comme traitée
        </button>
        <button
          type="button"
          className={`${boutonClasse} text-error`}
          disabled={!peutRejeter || changerStatut.isPending}
          onClick={() => changerStatut.mutate('REJETE')}
        >
          Rejeter
        </button>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-on-surface-variant">Nom</dt>
            <dd className="font-medium text-on-background">{demande.data.nomComplet}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Entreprise</dt>
            <dd className="font-medium text-on-background">{demande.data.entreprise ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Email</dt>
            <dd className="font-medium text-on-background">{demande.data.email}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Téléphone</dt>
            <dd className="font-medium text-on-background">{demande.data.telephone}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Activité</dt>
            <dd className="font-medium text-on-background">
              {LIBELLES_ACTIVITE[demande.data.typeActivite] ?? demande.data.typeActivite}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Nombre de points de service</dt>
            <dd className="font-medium text-on-background">
              {demande.data.nombrePointsDeService ?? '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-on-surface-variant">Demande</dt>
            <dd className="font-medium text-on-background">
              {LIBELLES_TYPE_DEMANDE[demande.data.typeDemande] ?? demande.data.typeDemande}
            </dd>
          </div>
        </dl>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">Message</p>
          <p className="text-sm text-on-surface whitespace-pre-wrap">{demande.data.message}</p>
        </div>
      </div>
    </div>
  );
}
