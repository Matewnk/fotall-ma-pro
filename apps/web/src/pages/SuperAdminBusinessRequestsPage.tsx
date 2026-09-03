import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api-client';
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
  DEVIS: 'Devis',
  INFORMATIONS: 'Informations',
  DEMONSTRATION: 'Démonstration',
  ACCOMPAGNEMENT: 'Accompagnement',
  AUTRE: 'Autre',
};

const FILTRES = ['TOUTES', 'NOUVEAU', 'EN_COURS', 'TRAITE', 'REJETE'] as const;
type Filtre = (typeof FILTRES)[number];

const LIBELLES_FILTRE: Record<Filtre, string> = {
  TOUTES: 'Toutes',
  NOUVEAU: 'Nouvelles',
  EN_COURS: 'En cours',
  TRAITE: 'Traitées',
  REJETE: 'Rejetées',
};

// Formulaire "Nous contacter" de la carte plan Business — vue globale
// Super-Admin. GET /super-admin/demandes-business lit toutes les demandes
// (control-plane, ni tenant-scope ni mode support requis : une demande de
// contact est déjà explicitement adressée à la plateforme). Le filtre par
// statut est appliqué côté serveur (§statut), la recherche libre reste
// côté client comme SuperAdminSupportPage.
export function SuperAdminBusinessRequestsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [filtre, setFiltre] = useState<Filtre>('TOUTES');

  const demandes = useQuery({
    queryKey: ['super-admin-business-requests', filtre],
    queryFn: () =>
      apiFetch<DemandeBusiness[]>(
        `/super-admin/demandes-business${filtre !== 'TOUTES' ? `?statut=${filtre}` : ''}`,
        { token },
      ),
  });

  const demandesAffichees = demandes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-background">Demandes Business</h1>
        <p className="text-sm text-on-surface-variant">
          Demandes de contact envoyées depuis la carte plan Business.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
              filtre === f
                ? 'border-primary bg-primary-container/20 text-primary'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            {LIBELLES_FILTRE[f]}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Entreprise</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Téléphone</th>
              <th className="px-4 py-2">Activité</th>
              <th className="px-4 py-2">Demande</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {demandes.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={9}>
                  Chargement…
                </td>
              </tr>
            )}
            {!demandes.isPending && demandesAffichees.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={9}>
                  Aucune demande.
                </td>
              </tr>
            )}
            {demandesAffichees.map((demande) => (
              <tr key={demande.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-medium text-on-surface">{demande.nomComplet}</td>
                <td className="px-4 py-2 text-on-surface-variant">{demande.entreprise}</td>
                <td className="px-4 py-2 text-on-surface-variant">{demande.email}</td>
                <td className="px-4 py-2 text-on-surface-variant">{demande.telephone}</td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {LIBELLES_ACTIVITE[demande.typeActivite] ?? demande.typeActivite}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {LIBELLES_TYPE_DEMANDE[demande.typeDemande] ?? demande.typeDemande}
                </td>
                <td className="px-4 py-2 text-on-surface-variant">
                  {new Date(demande.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${COULEURS_STATUT[demande.statut]}`}
                  >
                    {LIBELLES_STATUT[demande.statut]}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/super-admin/business-requests/${demande.id}`}
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
