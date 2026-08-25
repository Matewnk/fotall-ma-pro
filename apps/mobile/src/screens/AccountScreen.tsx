import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';

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
  conteneur: { flex: 1, padding: 24, gap: 8 },
  titre: { fontSize: 20, fontWeight: 'bold', color: '#1e3a8a' },
  info: { fontSize: 14, color: '#111827' },
  role: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', marginBottom: 16 },
  bouton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  boutonTexte: { color: '#dc2626', fontWeight: '600' },
});
