import { useNavigation, useRoute } from '@react-navigation/native';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';

type Etat = 'chargement' | 'pret' | 'erreur';

function blobEnBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.onload = () => {
      // readAsDataURL produit "data:application/pdf;base64,<contenu>" —
      // seule la partie après la virgule intéresse writeAsStringAsync.
      const dataUrl = lecteur.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    lecteur.readAsDataURL(blob);
  });
}

// Ticket réel après un encaissement réussi (mobile) — retour de test
// manuel : l'utilisateur veut le même PDF que le web
// (OrderCheckoutPage.tsx : apiFetchBlob('/commandes/:id/ticket/pdf')
// ouvert dans un nouvel onglet), pas une reconstitution native. Pas de
// visionneuse PDF intégrée disponible sans dépendance native dans Expo
// Go : le PDF est téléchargé via fetch (pas FileSystem.downloadAsync —
// son mécanisme de téléchargement natif se bloque indéfiniment en HTTP
// non chiffré sur Android, contrainte de réseau propre au niveau natif,
// alors que le fetch JS classique déjà utilisé partout ailleurs dans
// l'app fonctionne sans problème), écrit en base64 sur disque, puis
// ouvert via la feuille de partage native (expo-sharing) — laisse
// choisir "Ouvrir dans…" un lecteur PDF, l'imprimer ou le partager.
// Les deux packages sont inclus dans Expo Go, aucun client de dev
// personnalisé requis.
export function TicketScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commandeId } = route.params as { commandeId: string };
  const { session, chargement: sessionEnChargement } = useAuth();
  const token = session?.accessToken;

  const [etat, setEtat] = useState<Etat>('chargement');
  const [cheminFichier, setCheminFichier] = useState<string | null>(null);

  async function ouvrir(uri: string) {
    if (await isAvailableAsync()) {
      await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Ticket' });
    }
  }

  async function telechargerEtOuvrir() {
    setEtat('chargement');
    try {
      const reponse = await fetch(apiUrl(`/commandes/${commandeId}/ticket/pdf`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const base64 = await blobEnBase64(await reponse.blob());
      const destination = `${cacheDirectory}ticket-${commandeId}.pdf`;
      await writeAsStringAsync(destination, base64, { encoding: 'base64' });
      setCheminFichier(destination);
      setEtat('pret');
      await ouvrir(destination);
    } catch {
      setEtat('erreur');
    }
  }

  useEffect(() => {
    // Attend la résolution de la session (AsyncStorage.getItem est
    // asynchrone, cf. auth-context.tsx) avant de lancer le téléchargement
    // — sinon le premier appel partirait sans en-tête Authorization.
    if (sessionEnChargement) return;
    telechargerEtOuvrir();
  }, [sessionEnChargement]);

  function nouvelleCommande() {
    // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir AuthenticatedStack.tsx
    navigation.navigate('NouvelleCommande');
  }

  return (
    <View style={styles.conteneur}>
      {etat === 'chargement' && (
        <>
          <ActivityIndicator color={couleurs.primary} />
          <Text style={styles.texte}>Préparation du ticket…</Text>
        </>
      )}
      {etat === 'erreur' && <Text style={styles.erreur}>Impossible d'ouvrir le ticket.</Text>}
      {etat === 'pret' && <Text style={styles.texte}>Ticket prêt.</Text>}

      {etat !== 'chargement' && (
        <Pressable
          onPress={cheminFichier ? () => ouvrir(cheminFichier) : telechargerEtOuvrir}
          accessibilityRole="button"
          style={styles.boutonSecondaire}
        >
          <Text style={styles.boutonSecondaireTexte}>
            {cheminFichier ? 'Ouvrir le ticket' : 'Réessayer'}
          </Text>
        </Pressable>
      )}

      <Pressable onPress={nouvelleCommande} accessibilityRole="button" style={styles.bouton}>
        <Text style={styles.boutonTexte}>Nouvelle commande</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: couleurs.background,
    padding: espacement.margeMobile,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  texte: { color: couleurs.onSurfaceVariant },
  erreur: { color: couleurs.error, textAlign: 'center' },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  boutonSecondaireTexte: { color: couleurs.onSurface, fontWeight: '600' },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'stretch',
  },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
});
