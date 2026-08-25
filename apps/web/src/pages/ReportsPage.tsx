import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, apiFetchBlob } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { declencherTelechargement } from '../lib/download';

type TableauRapport = {
  colonnes: string[];
  lignes: (string | number)[][];
  resume?: Record<string, string | number>;
};

const RAPPORT_PAR_DEFAUT = 'caisse-quotidienne';

// Le résumé (TableauRapport.resume) est un Record<string, ...> côté API,
// avec des clés camelCase (soldeOuverture) ou dynamiques (`total${TypeOperationCaisse}`,
// ex. totalENCAISSEMENT) — jamais des libellés d'affichage. Cette table
// traduit les clés connues ; toute clé imprévue retombe sur un espacement
// automatique plutôt que sur la clé brute.
const LIBELLES_RESUME_STATIQUES: Record<string, string> = {
  soldeOuverture: "Solde d'ouverture",
  soldeCloture: 'Solde de clôture',
  periodeDebut: 'Période du',
  periodeFin: 'Période au',
  totalCommandes: 'Total commandes',
  chiffreAffaires: "Chiffre d'affaires",
};

const LIBELLES_TYPE_OPERATION: Record<string, string> = {
  OUVERTURE: 'Ouverture',
  ENCAISSEMENT: 'Encaissement',
  AVANCE: 'Avance',
  DEPENSE: 'Dépense',
  REMBOURSEMENT: 'Remboursement',
  AJUSTEMENT_COMPENSATOIRE: 'Ajustement compensatoire',
  CLOTURE: 'Clôture',
};

function libelleResume(cle: string): string {
  if (cle in LIBELLES_RESUME_STATIQUES) {
    return LIBELLES_RESUME_STATIQUES[cle];
  }
  const operation = cle.match(/^total([A-Z_]+)$/)?.[1];
  if (operation) {
    return `Total ${LIBELLES_TYPE_OPERATION[operation] ?? operation}`;
  }
  // Repli générique : espace avant chaque majuscule (camelCase -> mots).
  return cle.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

const RAPPORTS: { chemin: string; libelle: string; plage: boolean }[] = [
  { chemin: RAPPORT_PAR_DEFAUT, libelle: 'Caisse quotidienne', plage: false },
  { chemin: 'activite', libelle: 'Activité', plage: true },
  { chemin: 'recettes-par-service', libelle: 'Recettes par service', plage: true },
  { chemin: 'services-populaires', libelle: 'Services les plus utilisés', plage: true },
  { chemin: 'top-clients', libelle: 'Top clients', plage: true },
  { chemin: 'livraisons-retraits', libelle: 'Livraisons / retraits', plage: true },
  { chemin: 'commandes-en-retard', libelle: 'Commandes en retard', plage: false },
  { chemin: 'paiements', libelle: 'Paiements', plage: true },
];

// Écran §014 (rapports) — maquette de référence :
// docs/design/screens/statistiques_avanc_es_rentabilit. La maquette
// présente des graphiques et des KPI (marge nette, CAC, valeur moyenne)
// qu'aucun rapport de l'API ne calcule : l'API expose 8 rapports sous un
// contrat tabulaire générique unique (TableauRapport : colonnes + lignes +
// résumé optionnel, reports.types.ts) — adapté fidèlement à ce contrat
// plutôt qu'à des métriques inventées.
export function ReportsPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [rapport, setRapport] = useState(RAPPORT_PAR_DEFAUT);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState<'csv' | 'pdf' | null>(null);

  // RAPPORT_PAR_DEFAUT référence toujours une entrée de RAPPORTS (constantes
  // liées ci-dessus) : le repli ne peut jamais échouer en pratique.
  const definition = RAPPORTS.find((r) => r.chemin === rapport) ?? {
    chemin: RAPPORT_PAR_DEFAUT,
    libelle: 'Caisse quotidienne',
    plage: false,
  };

  function construireQuery(format?: 'csv' | 'pdf'): string {
    const params = new URLSearchParams();
    if (definition.plage && from) params.set('from', from);
    if (definition.plage && to) params.set('to', to);
    if (format) params.set('format', format);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  const donnees = useQuery({
    queryKey: ['rapport', rapport, from, to],
    queryFn: () => apiFetch<TableauRapport>(`/rapports/${rapport}${construireQuery()}`, { token }),
  });

  async function exporter(format: 'csv' | 'pdf') {
    setErreur(null);
    setExportEnCours(format);
    try {
      const blob = await apiFetchBlob(`/rapports/${rapport}${construireQuery(format)}`, {
        token,
      });
      declencherTelechargement(blob, `${rapport}.${format}`);
    } catch {
      setErreur("Impossible d'exporter ce rapport.");
    } finally {
      setExportEnCours(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-on-background">Rapports</h1>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={exportEnCours !== null}
            onClick={() => exporter('csv')}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60"
          >
            {exportEnCours === 'csv' ? 'Export…' : 'Exporter CSV'}
          </button>
          <button
            type="button"
            disabled={exportEnCours !== null}
            onClick={() => exporter('pdf')}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-outline-variant text-on-surface-variant disabled:opacity-60"
          >
            {exportEnCours === 'pdf' ? 'Export…' : 'Exporter PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-sm">
          Rapport
          <select
            className="border border-outline-variant rounded-lg px-3 py-2"
            value={rapport}
            onChange={(event) => setRapport(event.target.value)}
          >
            {RAPPORTS.map((r) => (
              <option key={r.chemin} value={r.chemin}>
                {r.libelle}
              </option>
            ))}
          </select>
        </label>
        {definition.plage && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Du
              <input
                type="date"
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Au
              <input
                type="date"
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {erreur && <p className="text-sm text-error">{erreur}</p>}

      {donnees.data?.resume && Object.keys(donnees.data.resume).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(donnees.data.resume).map(([cle, valeur]) => (
            <div key={cle} className="bg-surface border border-outline-variant rounded-xl p-4">
              <p className="text-xs text-on-surface-variant">{libelleResume(cle)}</p>
              <p className="text-xl font-bold text-on-background">{valeur}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              {donnees.data?.colonnes.map((colonne) => (
                <th key={colonne} className="px-4 py-2 whitespace-nowrap">
                  {colonne}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donnees.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant">Chargement…</td>
              </tr>
            )}
            {donnees.data?.lignes.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant">Aucune donnée.</td>
              </tr>
            )}
            {donnees.data?.lignes.map((ligne, index) => (
              <tr key={index} className="border-t border-outline-variant">
                {ligne.map((valeur, colIndex) => (
                  <td key={colIndex} className="px-4 py-2 whitespace-nowrap">
                    {valeur}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
