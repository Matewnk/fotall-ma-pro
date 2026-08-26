import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { Dashboard } from '../lib/types';

// Équivalent mobile de apps/web/src/pages/DashboardPage.tsx (021, retour
// de test manuel : parité web/mobile). Même contrat GET /dashboard,
// ouvert à ADMIN/CAISSIER/TECHNICIEN/LIVREUR.
export function DashboardScreen() {
  const { session } = useAuth();
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<Dashboard>('/dashboard', { token: session?.accessToken }),
  });

  if (isPending) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={couleurs.primary} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.centre}>
        <Text style={styles.erreur}>Impossible de charger le tableau de bord.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.conteneur}
      contentContainerStyle={styles.contenu}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      {data.alertes.licenceProcheExpiration.active && (
        <View style={styles.alerte}>
          <Text style={styles.alerteTitre}>Essai bientôt terminé</Text>
          <Text style={styles.alerteTexte}>
            Il reste {data.alertes.licenceProcheExpiration.joursRestants} jour(s) avant la fin de
            votre essai gratuit.
          </Text>
        </View>
      )}

      <Text style={typographie.headlineLg}>Tableau de bord</Text>

      <View style={styles.grilleKpi}>
        <KpiCard libelle="Commandes du jour" valeur={data.kpis.commandesDuJour} />
        <KpiCard
          libelle="Chiffre d'affaires du jour"
          valeur={`${data.kpis.chiffreAffairesDuJour} FCFA`}
        />
        <KpiCard libelle="Articles en attente" valeur={data.kpis.articlesEnAttente} />
        <KpiCard libelle="Livraisons prévues" valeur={data.kpis.livraisonsPrevuesAujourdHui} />
        <KpiCard
          libelle="Commandes en retard"
          valeur={data.kpis.commandesEnRetard}
          alerte={data.kpis.commandesEnRetard > 0}
        />
        <KpiCard
          libelle="Paiements en attente"
          valeur={data.alertes.paiementsEnAttente}
          alerte={data.alertes.paiementsEnAttente > 0}
        />
      </View>

      <View style={styles.carteListe}>
        <Text style={styles.titreSection}>Commandes récentes</Text>
        {data.commandesRecentes.length === 0 && (
          <Text style={styles.videTexte}>Aucune commande pour l'instant.</Text>
        )}
        {data.commandesRecentes.map((commande) => (
          <View key={commande.numero} style={styles.ligneCommande}>
            <View style={styles.ligneCommandeInfo}>
              <Text style={styles.ligneCommandeNumero}>#{commande.numero}</Text>
              <Text style={styles.ligneCommandeClient}>{commande.client.nom}</Text>
            </View>
            <View style={styles.ligneCommandeDroite}>
              <Text style={styles.ligneCommandeMontant}>{commande.montant} FCFA</Text>
              <StatusBadge statut={commande.statut} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  contenu: { padding: espacement.margeMobile, gap: espacement.gutter },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  erreur: { color: couleurs.error },
  alerte: {
    backgroundColor: couleurs.errorContainer,
    borderRadius: rayon.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: couleurs.error,
  },
  alerteTitre: { fontWeight: '700', color: couleurs.onErrorContainer },
  alerteTexte: { color: couleurs.onErrorContainer, marginTop: 4 },
  grilleKpi: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.base },
  carteListe: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 16,
    gap: 12,
  },
  titreSection: { fontWeight: '700', color: couleurs.onSurface },
  videTexte: { color: couleurs.onSurfaceVariant, fontSize: 13 },
  ligneCommande: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: couleurs.outlineVariant,
    paddingTop: 10,
  },
  ligneCommandeInfo: { gap: 2 },
  ligneCommandeNumero: { fontWeight: '600', color: couleurs.onSurface },
  ligneCommandeClient: { fontSize: 12, color: couleurs.onSurfaceVariant },
  ligneCommandeDroite: { alignItems: 'flex-end', gap: 4 },
  ligneCommandeMontant: { fontWeight: '600', color: couleurs.onSurface },
});
