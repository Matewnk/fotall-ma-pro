import { StyleSheet, Text, View } from 'react-native';
import type { StatutCommande } from '../lib/types';
import { couleurs, rayon } from '../lib/theme';

// Équivalent mobile de apps/web/src/components/StatusBadge.tsx —
// même renommage "Terminé" pour PRET (021, retour de test manuel : suivi
// de progression du travail plutôt que la valeur brute de l'enum).
export const LIBELLES_STATUT_COMMANDE: Record<StatutCommande, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  PRET: 'Terminé',
  LIVRE: 'Livré',
};

const COULEURS_STATUT: Record<StatutCommande, string> = {
  EN_ATTENTE: couleurs.statutEnAttente,
  EN_COURS: couleurs.statutEnCours,
  PRET: couleurs.statutTermine,
  LIVRE: couleurs.statutLivre,
};

export function StatusBadge({ statut }: { statut: StatutCommande }) {
  const couleur = COULEURS_STATUT[statut];
  return (
    <View style={[styles.badge, { backgroundColor: `${couleur}1A` }]}>
      <Text style={[styles.texte, { color: couleur }]}>{LIBELLES_STATUT_COMMANDE[statut]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: rayon.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  texte: { fontSize: 11, fontWeight: '600' },
});
