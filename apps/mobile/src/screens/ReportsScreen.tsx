import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';

type TableauRapport = {
  colonnes: string[];
  lignes: (string | number)[][];
  resume?: Record<string, string | number>;
};

const RAPPORT_PAR_DEFAUT = 'caisse-quotidienne';

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
    return LIBELLES_RESUME_STATIQUES[cle] ?? cle;
  }
  const operation = cle.match(/^total([A-Z_]+)$/)?.[1];
  if (operation) {
    return `Total ${LIBELLES_TYPE_OPERATION[operation] ?? operation}`;
  }
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

// Équivalent mobile de apps/web/src/pages/ReportsPage.tsx (021, retour de
// test manuel : parité web/mobile), réservé ADMIN (reports.controller.ts).
// Même contrat GET /rapports/:chemin (TableauRapport : colonnes + lignes +
// résumé optionnel). Simplification volontaire "saisie rapide terrain" :
// l'export CSV/PDF (declencherTelechargement, blob de navigateur) n'a pas
// d'équivalent direct sans flux de sauvegarde fichier mobile — omis ici,
// consultation en lecture seule.
export function ReportsScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [rapport, setRapport] = useState(RAPPORT_PAR_DEFAUT);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const definition = RAPPORTS.find((r) => r.chemin === rapport) ?? {
    chemin: RAPPORT_PAR_DEFAUT,
    libelle: 'Caisse quotidienne',
    plage: false,
  };

  function construireQuery(): string {
    const params = new URLSearchParams();
    if (definition.plage && from) params.set('from', from);
    if (definition.plage && to) params.set('to', to);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  const donnees = useQuery({
    queryKey: ['rapport', rapport, from, to],
    queryFn: () => apiFetch<TableauRapport>(`/rapports/${rapport}${construireQuery()}`, { token }),
  });

  const entreesResume = donnees.data?.resume ? Object.entries(donnees.data.resume) : [];

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={styles.contenu}>
      <Text style={typographie.headlineLg}>Rapports</Text>

      <View style={styles.selecteurRapport}>
        {RAPPORTS.map((r) => (
          <Pressable
            key={r.chemin}
            onPress={() => setRapport(r.chemin)}
            accessibilityRole="button"
            style={[styles.puceRapport, rapport === r.chemin && styles.puceRapportActive]}
          >
            <Text
              style={[
                styles.puceRapportTexte,
                rapport === r.chemin && styles.puceRapportTexteActive,
              ]}
            >
              {r.libelle}
            </Text>
          </Pressable>
        ))}
      </View>

      {definition.plage && (
        <View style={styles.plageDates}>
          <TextInput
            style={[styles.champ, { flex: 1 }]}
            placeholder="Du (AAAA-MM-JJ)"
            accessibilityLabel="Date de début"
            value={from}
            onChangeText={setFrom}
          />
          <TextInput
            style={[styles.champ, { flex: 1 }]}
            placeholder="Au (AAAA-MM-JJ)"
            accessibilityLabel="Date de fin"
            value={to}
            onChangeText={setTo}
          />
        </View>
      )}

      {entreesResume.length > 0 && (
        <View style={styles.cartesResume}>
          {entreesResume.map(([cle, valeur]) => (
            <View key={cle} style={styles.carteResume}>
              <Text style={styles.carteResumeLibelle}>{libelleResume(cle)}</Text>
              <Text style={styles.carteResumeValeur}>{String(valeur)}</Text>
            </View>
          ))}
        </View>
      )}

      {donnees.isPending && <Text style={styles.videTexte}>Chargement…</Text>}
      {donnees.data?.lignes.length === 0 && <Text style={styles.videTexte}>Aucune donnée.</Text>}

      {(donnees.data?.lignes.length ?? 0) > 0 && (
        <ScrollView horizontal style={styles.tableauScroll}>
          <View>
            <View style={styles.ligneEntete}>
              {donnees.data?.colonnes.map((colonne) => (
                <Text key={colonne} style={styles.celluleEntete}>
                  {colonne}
                </Text>
              ))}
            </View>
            {donnees.data?.lignes.map((ligne, index) => (
              <View key={index} style={styles.ligneDonnee}>
                {ligne.map((valeur, colIndex) => (
                  <Text key={colIndex} style={styles.cellule}>
                    {String(valeur)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </ScrollView>
  );
}

const LARGEUR_CELLULE = 130;

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  contenu: { padding: espacement.margeMobile, gap: espacement.base, paddingBottom: 24 },
  selecteurRapport: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puceRapport: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  puceRapportActive: { backgroundColor: couleurs.primary, borderColor: couleurs.primary },
  puceRapportTexte: { fontSize: 12, color: couleurs.onSurface },
  puceRapportTexteActive: { color: couleurs.onPrimary, fontWeight: '600' },
  plageDates: { flexDirection: 'row', gap: 8 },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cartesResume: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carteResume: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 12,
    minWidth: 130,
  },
  carteResumeLibelle: { fontSize: 11, color: couleurs.onSurfaceVariant },
  carteResumeValeur: { fontSize: 16, fontWeight: '700', color: couleurs.onSurface, marginTop: 4 },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
  tableauScroll: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
  },
  ligneEntete: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.outlineVariant,
  },
  celluleEntete: {
    width: LARGEUR_CELLULE,
    padding: 10,
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  ligneDonnee: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.outlineVariant,
  },
  cellule: { width: LARGEUR_CELLULE, padding: 10, fontSize: 13, color: couleurs.onSurface },
});
