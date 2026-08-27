import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';
import type { TicketData } from '../lib/types';

// Ticket de caisse affiché juste après un encaissement réussi (mobile) —
// équivalent de l'ouverture automatique du PDF sur web
// (OrderCheckoutPage.tsx : apiFetchBlob('/commandes/:id/ticket/pdf') dans
// un nouvel onglet). Affichage natif plutôt qu'un PDF : pas de lecteur
// PDF/partage de fichier dans l'app mobile actuelle (même limite que
// DeliverySlipScreen.tsx). Mêmes données que le ticket web (GET
// .../ticket/data). Le bouton "Nouvelle commande" remplace la navigation
// automatique qu'effectuait directement OrderCheckoutScreen.tsx avant ce
// correctif.
export function TicketScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commandeId } = route.params as { commandeId: string };
  const { session } = useAuth();
  const token = session?.accessToken;

  const donnees = useQuery({
    queryKey: ['ticket-data', commandeId],
    queryFn: () => apiFetch<TicketData>(`/commandes/${commandeId}/ticket/data`, { token }),
  });

  if (donnees.isPending) {
    return (
      <View style={styles.conteneur}>
        <ActivityIndicator />
      </View>
    );
  }
  if (donnees.isError || !donnees.data) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.erreur}>Ticket introuvable.</Text>
      </View>
    );
  }

  const data = donnees.data;

  function nouvelleCommande() {
    // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir AuthenticatedStack.tsx
    navigation.navigate('NouvelleCommande');
  }

  return (
    <ScrollView
      style={styles.conteneur}
      contentContainerStyle={{ gap: espacement.gutter, padding: espacement.margeMobile }}
    >
      <View style={styles.entete}>
        <Text style={styles.nomPressing}>{data.nomPressing}</Text>
        {data.adresseTenant && <Text style={styles.sousTexte}>{data.adresseTenant}</Text>}
        {data.telephoneTenant && <Text style={styles.sousTexte}>{data.telephoneTenant}</Text>}
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.titre}>TICKET DE CAISSE</Text>
        <View style={styles.ligneListe}>
          <Text style={styles.sousTexte}>Commande</Text>
          <Text style={styles.valeurMono}>#{data.numero}</Text>
        </View>
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.section}>CLIENT</Text>
        <Text style={styles.gras}>{data.client.nom}</Text>
        <Text style={styles.sousTexte}>{data.client.telephone}</Text>
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.section}>ARTICLES</Text>
        {data.articles.map((article, index) => (
          <View key={index} style={styles.ligneArticle}>
            <Text style={styles.article}>
              {article.quantite}x {article.intitule}
            </Text>
            <Text style={styles.valeurMono}>{article.sousTotal} FCFA</Text>
          </View>
        ))}
        <View style={[styles.ligneListe, styles.totauxBloc]}>
          <Text style={styles.sousTexte}>Sous-total</Text>
          <Text style={styles.valeurMono}>{data.sousTotal} FCFA</Text>
        </View>
        {Number(data.remise) > 0 && (
          <View style={styles.ligneListe}>
            <Text style={styles.sousTexte}>Remise</Text>
            <Text style={styles.valeurMono}>-{data.remise} FCFA</Text>
          </View>
        )}
        <View style={styles.ligneListe}>
          <Text style={styles.gras}>Total</Text>
          <Text style={[styles.gras, styles.valeurMono]}>{data.total} FCFA</Text>
        </View>
      </View>

      <View style={styles.separateur} />

      <View style={styles.pied}>
        <Text style={styles.sousTexte}>Merci de votre confiance !</Text>
        <Text style={styles.sousTexte}>Propulsé par Fotall-Ma PRO</Text>
      </View>

      <Pressable onPress={nouvelleCommande} accessibilityRole="button" style={styles.bouton}>
        <Text style={styles.boutonTexte}>Nouvelle commande</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.surfaceContainerLowest },
  entete: { alignItems: 'center', gap: 2 },
  nomPressing: { fontSize: 18, fontWeight: '700', color: couleurs.onSurface },
  sousTexte: { color: couleurs.onSurfaceVariant, fontSize: 12 },
  separateur: { borderTopWidth: 1, borderTopColor: couleurs.outline, borderStyle: 'dashed' },
  titre: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
    color: couleurs.onSurface,
  },
  section: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    color: couleurs.onSurfaceVariant,
    marginBottom: 6,
  },
  ligneListe: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  ligneArticle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 8,
  },
  valeurMono: { fontFamily: 'monospace', fontWeight: '600', color: couleurs.onSurface },
  gras: { fontWeight: '700', color: couleurs.onSurface },
  article: { flex: 1, color: couleurs.onSurface },
  totauxBloc: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: couleurs.outlineVariant,
  },
  pied: { alignItems: 'center', gap: 2 },
  erreur: { color: couleurs.error, fontSize: 13, textAlign: 'center', marginTop: 24 },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
});
