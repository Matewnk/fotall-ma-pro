import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, apiFetch } from '../lib/api-client';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';

type SuiviCommande = {
  numero: number;
  statut: 'EN_ATTENTE' | 'EN_COURS' | 'PRET' | 'LIVRE';
  total: string;
  modeLivraison: string;
  articles: { intitule: string; quantite: number; sousTotal: string }[];
  pressing: { nomPressing: string; telephone: string | null };
};

const ETAPES: SuiviCommande['statut'][] = ['EN_ATTENTE', 'EN_COURS', 'PRET', 'LIVRE'];
const LIBELLES_ETAPE: Record<SuiviCommande['statut'], string> = {
  EN_ATTENTE: 'Reçu',
  EN_COURS: 'En traitement',
  PRET: 'Prêt',
  LIVRE: 'Livré',
};

// Écran §016-mobile-offline tranche 5 (portail client) — maquette de
// référence : docs/design/screens/portail_client_suivi_de_commande_mobile.
// Aucune connexion (POST /suivi-commande, public, sans JWT — nouveau
// backend requis, voir spec.md). Points fidélité de la maquette non
// repris : aucun système de fidélité n'existe côté API.
export function CustomerTrackingScreen() {
  const [sousDomaine, setSousDomaine] = useState('');
  const [numero, setNumero] = useState('');
  const [telephone, setTelephone] = useState('');
  const [suivi, setSuivi] = useState<SuiviCommande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function rechercher() {
    setErreur(null);
    setSuivi(null);
    setEnCours(true);
    try {
      const resultat = await apiFetch<SuiviCommande>('/suivi-commande', {
        method: 'POST',
        body: { sousDomaine, numero: Number(numero), telephone },
      });
      setSuivi(resultat);
    } catch (error) {
      setErreur(
        error instanceof ApiError
          ? error.message
          : 'Commande introuvable. Vérifiez le sous-domaine, le numéro et le téléphone.',
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ScrollView
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.margeMobile, gap: espacement.gutter }}
    >
      <Text style={styles.titre}>Suivre ma commande</Text>

      <TextInput
        style={styles.champ}
        placeholder="Sous-domaine du pressing"
        accessibilityLabel="Sous-domaine du pressing"
        autoCapitalize="none"
        value={sousDomaine}
        onChangeText={setSousDomaine}
      />
      <TextInput
        style={styles.champ}
        placeholder="Numéro de commande"
        accessibilityLabel="Numéro de commande"
        keyboardType="number-pad"
        value={numero}
        onChangeText={setNumero}
      />
      <TextInput
        style={styles.champ}
        placeholder="Téléphone"
        accessibilityLabel="Téléphone"
        keyboardType="phone-pad"
        value={telephone}
        onChangeText={setTelephone}
      />

      <Pressable
        style={styles.bouton}
        onPress={rechercher}
        disabled={enCours}
        accessibilityRole="button"
      >
        {enCours ? (
          <ActivityIndicator color={couleurs.onPrimary} />
        ) : (
          <Text style={styles.boutonTexte}>Rechercher</Text>
        )}
      </Pressable>

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      {suivi && (
        <View style={styles.carte}>
          <Text style={styles.numero}>Commande #{suivi.numero}</Text>
          <View style={styles.etapes}>
            {ETAPES.map((etape, index) => (
              <Text
                key={etape}
                style={
                  ETAPES.indexOf(suivi.statut) >= index ? styles.etapeAtteinte : styles.etapeAvenir
                }
              >
                {LIBELLES_ETAPE[etape]}
                {index < ETAPES.length - 1 ? ' → ' : ''}
              </Text>
            ))}
          </View>
          {suivi.articles.map((article) => (
            <Text key={article.intitule}>
              {article.quantite}x {article.intitule} — {article.sousTotal} FCFA
            </Text>
          ))}
          <Text style={styles.total}>Total : {suivi.total} FCFA</Text>
          <Text style={styles.pressing}>{suivi.pressing.nomPressing}</Text>
          {suivi.pressing.telephone && <Text>{suivi.pressing.telephone}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  titre: { ...typographie.headlineMd, color: couleurs.primary },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
  erreur: { color: couleurs.error, fontSize: 13 },
  carte: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 16,
    gap: 8,
    backgroundColor: couleurs.surfaceContainerLowest,
  },
  numero: { fontFamily: 'monospace', fontWeight: '600', fontSize: 16, color: couleurs.onSurface },
  etapes: { flexDirection: 'row', flexWrap: 'wrap' },
  etapeAtteinte: { color: couleurs.primary, fontWeight: '600' },
  etapeAvenir: { color: couleurs.onSurfaceVariant },
  total: { fontWeight: 'bold', color: couleurs.onSurface },
  pressing: { marginTop: 8, fontWeight: '600', color: couleurs.onSurface },
});
