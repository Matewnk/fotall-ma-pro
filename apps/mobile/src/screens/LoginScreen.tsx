import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

// Écran de connexion staff (CAISSIER/TECHNICIEN/LIVREUR/ADMIN) —
// équivalent mobile de apps/web/src/pages/LoginPage.tsx, même contrat
// POST /auth/login (sous-domaine + email + mot de passe). Le portail
// client (public, sans connexion) est un écran séparé — voir spec.md.
export function LoginScreen() {
  const { login } = useAuth();
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.boutonTexte}>Se connecter</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  titre: { fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' },
  sousTitre: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  champ: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: '#dc2626', fontSize: 13 },
  bouton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonTexte: { color: '#fff', fontWeight: '600' },
});
