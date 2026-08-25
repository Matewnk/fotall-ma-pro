import { useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { TicketData } from '../lib/types';

// Bon de livraison (LIVREUR, mobile) — maquette de référence :
// docs/design/screens/bon_de_livraison_pressing. Affichage natif plutôt
// qu'un PDF : pas de lecteur PDF/partage de fichier dans l'app mobile
// actuelle. Mêmes données que le ticket web (GET .../ticket/data), zone/
// code porte/créneau horaire de la maquette non repris (aucun champ
// correspondant sur Commande). Capture de signature hors périmètre.
export function DeliverySlipScreen() {
  const route = useRoute();
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
        <Text style={styles.erreur}>Bon de livraison introuvable.</Text>
      </View>
    );
  }

  const data = donnees.data;
  const totalArticles = data.articles.reduce((somme, article) => somme + article.quantite, 0);

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ gap: 16, padding: 16 }}>
      <View style={styles.entete}>
        <Text style={styles.nomPressing}>{data.nomPressing}</Text>
        {data.adresseTenant && <Text style={styles.sousTexte}>{data.adresseTenant}</Text>}
        {data.telephoneTenant && <Text style={styles.sousTexte}>{data.telephoneTenant}</Text>}
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.titre}>BON DE LIVRAISON</Text>
        <View style={styles.ligneListe}>
          <Text style={styles.sousTexte}>Commande</Text>
          <Text style={styles.valeurMono}>#{data.numero}</Text>
        </View>
        {data.datePrevue && (
          <View style={styles.ligneListe}>
            <Text style={styles.sousTexte}>Date prévue</Text>
            <Text style={styles.valeurMono}>{data.datePrevue.slice(0, 10)}</Text>
          </View>
        )}
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.section}>INFORMATIONS CLIENT</Text>
        <Text style={styles.gras}>{data.client.nom}</Text>
        <Text>{data.client.telephone}</Text>
        {data.adresseLivraison && <Text>{data.adresseLivraison}</Text>}
      </View>

      <View style={styles.separateur} />

      <View>
        <Text style={styles.section}>ARTICLES LIVRÉS</Text>
        {data.articles.map((article, index) => (
          <Text key={index} style={styles.article}>
            {article.quantite}x {article.intitule}
          </Text>
        ))}
        <View style={[styles.ligneListe, styles.totalArticles]}>
          <Text style={styles.gras}>Total articles :</Text>
          <Text style={[styles.gras, styles.valeurMono]}>{totalArticles}</Text>
        </View>
      </View>

      <View style={styles.separateur} />

      <View style={styles.signatures}>
        <View style={styles.zoneSignature}>
          <Text style={styles.section}>Signature Client</Text>
          <View style={styles.ligneSignature} />
        </View>
        <View style={styles.zoneSignature}>
          <Text style={styles.section}>Signature Livreur</Text>
          <View style={styles.ligneSignature} />
        </View>
      </View>

      <View style={styles.pied}>
        <Text style={styles.sousTexte}>Merci pour votre confiance.</Text>
        <Text style={styles.sousTexte}>Propulsé par Fotall-Ma PRO</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#fff' },
  entete: { alignItems: 'center', gap: 2 },
  nomPressing: { fontSize: 18, fontWeight: '700' },
  sousTexte: { color: '#6b7280', fontSize: 12 },
  separateur: { borderTopWidth: 1, borderTopColor: '#9ca3af', borderStyle: 'dashed' },
  titre: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  section: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#6b7280',
    marginBottom: 6,
  },
  ligneListe: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  valeurMono: { fontFamily: 'monospace', fontWeight: '600' },
  gras: { fontWeight: '700' },
  article: { marginBottom: 4 },
  totalArticles: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  signatures: { flexDirection: 'row', gap: 16, marginTop: 8 },
  zoneSignature: { flex: 1, gap: 24 },
  ligneSignature: { borderBottomWidth: 1, borderBottomColor: '#191b22' },
  pied: { alignItems: 'center', marginTop: 16, gap: 2 },
  erreur: { color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
