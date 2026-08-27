import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { EntreeAudit } from '../lib/types';

// Équivalent mobile de apps/web/src/pages/AuditPage.tsx (021, retour de
// test manuel : parité web/mobile). Même contrat GET /audit (tenant-scopé,
// audit.controller.ts), même placement de navigation restreint à ADMIN que
// le web (AppShell) — le masquage de menu n'est jamais une autorisation,
// le serveur revalide toujours le tenant courant.
export function AuditScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [filtreAction, setFiltreAction] = useState('');

  const entrees = useQuery({
    queryKey: ['audit', filtreAction],
    queryFn: () =>
      apiFetch<EntreeAudit[]>(
        `/audit${filtreAction ? `?action=${encodeURIComponent(filtreAction)}` : ''}`,
        { token },
      ),
  });

  return (
    <FlatList
      style={styles.conteneur}
      contentContainerStyle={styles.liste}
      data={entrees.data ?? []}
      keyExtractor={(entree) => entree.id}
      ListHeaderComponent={
        <View style={{ gap: espacement.base }}>
          <View>
            <Text style={typographie.headlineLg}>Journal d'audit</Text>
            <Text style={styles.sousTitre}>
              Actions sensibles enregistrées pour ce tenant (Constitution VII).
            </Text>
          </View>
          <TextInput
            style={styles.champ}
            placeholder="Filtrer par action (ex : TENANT_PLAN_MODIFIE)…"
            accessibilityLabel="Filtrer par action"
            value={filtreAction}
            onChangeText={setFiltreAction}
          />
          {entrees.isPending && <Text style={styles.videTexte}>Chargement…</Text>}
          {entrees.data?.length === 0 && !entrees.isPending && (
            <Text style={styles.videTexte}>Aucune entrée d'audit pour l'instant.</Text>
          )}
        </View>
      }
      renderItem={({ item: entree }) => (
        <View style={styles.ligne}>
          <Text style={styles.dateTexte}>{new Date(entree.createdAt).toLocaleString('fr-FR')}</Text>
          <Text style={styles.action}>{entree.action}</Text>
          <Text style={styles.entite}>
            {entree.entityType} <Text style={styles.entiteId}>#{entree.entityId}</Text>
          </Text>
          <Text style={styles.auteur}>{entree.actorId}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  liste: { padding: espacement.margeMobile, gap: 8, paddingBottom: 24 },
  sousTitre: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 4 },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
  ligne: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
    gap: 3,
  },
  dateTexte: { fontSize: 11, color: couleurs.onSurfaceVariant },
  action: { fontSize: 12, fontFamily: 'monospace', color: couleurs.onSurface },
  entite: { fontSize: 13, color: couleurs.onSurface },
  entiteId: { color: couleurs.onSurfaceVariant },
  auteur: { fontSize: 11, fontFamily: 'monospace', color: couleurs.onSurfaceVariant },
});
