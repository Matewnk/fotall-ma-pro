import { StyleSheet, Text, View } from 'react-native';
import { couleurs, rayon } from '../lib/theme';

// Équivalent mobile de apps/web/src/components/KpiCard.tsx.
export function KpiCard({
  libelle,
  valeur,
  alerte = false,
}: {
  libelle: string;
  valeur: string | number;
  alerte?: boolean;
}) {
  return (
    <View style={[styles.carte, alerte && styles.carteAlerte]}>
      <Text style={styles.libelle}>{libelle}</Text>
      <Text style={[styles.valeur, alerte && styles.valeurAlerte]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 16,
    gap: 4,
  },
  carteAlerte: { borderColor: couleurs.error },
  libelle: { fontSize: 12, color: couleurs.onSurfaceVariant },
  valeur: { fontSize: 24, fontWeight: '700', color: couleurs.onSurface },
  valeurAlerte: { color: couleurs.error },
});
