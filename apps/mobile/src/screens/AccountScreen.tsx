import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';

// Écran d'atterrissage après connexion — minimal pour cette fondation
// (navigation + auth), avant l'ajout des écrans métier (nouvelle
// commande CAISSIER, suivi TECHNICIEN/LIVREUR, portail client) dans les
// tranches suivantes.
export function AccountScreen() {
  const { session, logout } = useAuth();

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>{session?.tenant.nomPressing}</Text>
      <Text style={styles.info}>{session?.user.email}</Text>
      <Text style={styles.role}>{session?.user.role}</Text>

      <Pressable style={styles.bouton} onPress={() => logout()} accessibilityRole="button">
        <Text style={styles.boutonTexte}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    padding: espacement.margeMobile,
    gap: 8,
    backgroundColor: couleurs.background,
  },
  titre: { ...typographie.headlineMd, color: couleurs.primary },
  info: { fontSize: 14, color: couleurs.onSurface },
  role: {
    fontSize: 12,
    color: couleurs.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  bouton: {
    borderWidth: 1,
    borderColor: couleurs.error,
    borderRadius: rayon.lg,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  boutonTexte: { color: couleurs.error, fontWeight: '600' },
});
