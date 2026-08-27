import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, rayon, typographie } from '../lib/theme';

// Écran de connexion staff (CAISSIER/TECHNICIEN/LIVREUR/ADMIN) —
// équivalent mobile de apps/web/src/pages/LoginPage.tsx, même contrat
// POST /auth/login (sous-domaine + email + mot de passe). Le portail
// client (public, sans connexion) est un écran séparé accessible sans
// authentification — voir spec.md.
export function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation();
  const [sousDomaine, setSousDomaine] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit() {
    setErreur(null);
    setEnCours(true);
    try {
      await login(sousDomaine, email, motDePasse);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Fotall-Ma Pro</Text>
      <Text style={styles.sousTitre}>Connexion à votre pressing</Text>

      <TextInput
        style={styles.champ}
        placeholder="Sous-domaine"
        accessibilityLabel="Sous-domaine"
        autoCapitalize="none"
        value={sousDomaine}
        onChangeText={setSousDomaine}
      />
      <TextInput
        style={styles.champ}
        placeholder="Email"
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.champ}
        placeholder="Mot de passe"
        accessibilityLabel="Mot de passe"
        secureTextEntry
        value={motDePasse}
        onChangeText={setMotDePasse}
      />

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      <Pressable
        style={styles.bouton}
        disabled={enCours}
        onPress={handleSubmit}
        accessibilityRole="button"
      >
        {enCours ? (
          <ActivityIndicator color={couleurs.onPrimary} />
        ) : (
          <Text style={styles.boutonTexte}>Se connecter</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('SuiviClient' as never)}
        accessibilityRole="button"
      >
        <Text style={styles.lien}>Suivre ma commande</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: couleurs.background,
  },
  titre: { ...typographie.headlineLg, color: couleurs.primary },
  sousTitre: { fontSize: 14, color: couleurs.onSurfaceVariant, marginBottom: 12 },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: couleurs.error, fontSize: 13 },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
  lien: { color: couleurs.primary, textAlign: 'center', marginTop: 4 },
});
