import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';
import type { Commande, StatutCommande } from '../lib/types';

const LIBELLES_STATUT: Record<StatutCommande, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  PRET: 'Terminé',
  LIVRE: 'Livré',
};

// Prochaine étape du cycle (§9) : TECHNICIEN fait avancer
// EN_ATTENTE→EN_COURS→PRET, LIVREUR livre PRET→LIVRE. Un seul bouton par
// commande plutôt que des actions filtrées par rôle affiché — le serveur
// (PATCH /commandes/:id/statut, 009) reste la seule autorité RBAC réelle.
const PROCHAIN_STATUT: Partial<
  Record<StatutCommande, { statut: StatutCommande; libelle: string }>
> = {
  EN_ATTENTE: { statut: 'EN_COURS', libelle: 'Démarrer' },
  EN_COURS: { statut: 'PRET', libelle: 'Marquer terminé' },
  PRET: { statut: 'LIVRE', libelle: 'Marquer livré' },
};

const FILTRES: { valeur: StatutCommande | undefined; libelle: string }[] = [
  { valeur: undefined, libelle: 'Tout' },
  { valeur: 'EN_ATTENTE', libelle: 'En attente' },
  { valeur: 'EN_COURS', libelle: 'En cours' },
  { valeur: 'PRET', libelle: 'Terminé' },
];

// Écran §016-mobile-offline tranche 4 (TECHNICIEN/LIVREUR) — maquette de
// référence : docs/design/screens/suivi_technicien_livreur_mobile. Les
// onglets Technicien/Livreur et les filtres Lavage/Repassage de la
// maquette ne sont pas repris : la commande n'a qu'un seul statut
// (StatutCommande), pas de sous-étapes de traitement suivies côté API ;
// adapté au filtre réel disponible (GET /commandes?statut=).
export function OrdersStatusScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [filtre, setFiltre] = useState<StatutCommande | undefined>(undefined);

  const commandes = useQuery({
    queryKey: ['commandes', filtre],
    queryFn: () =>
      apiFetch<Commande[]>(`/commandes${filtre ? `?statut=${filtre}` : ''}`, { token }),
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutCommande }) =>
      apiFetch<Commande>(`/commandes/${id}/statut`, { method: 'PATCH', token, body: { statut } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
    },
  });

  return (
    <View style={styles.conteneur}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtres}>
        {FILTRES.map((f) => (
          <Pressable
            key={f.libelle}
            style={[styles.filtre, filtre === f.valeur && styles.filtreActif]}
            onPress={() => setFiltre(f.valeur)}
            accessibilityRole="button"
          >
            <Text style={filtre === f.valeur ? styles.filtreActifTexte : undefined}>
              {f.libelle}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ gap: 12, padding: espacement.margeMobile }}>
        {commandes.data?.length === 0 && (
          <Text style={styles.vide}>Aucune commande pour l'instant.</Text>
        )}
        {commandes.data?.map((commande) => {
          const action = PROCHAIN_STATUT[commande.statut];
          return (
            <View key={commande.id} style={styles.carte}>
              <View style={styles.carteEntete}>
                <Text style={styles.numero}>#{commande.numero}</Text>
                <Text style={styles.statut}>{LIBELLES_STATUT[commande.statut]}</Text>
              </View>
              <Text style={styles.montant}>{commande.total} FCFA</Text>
              {commande.modeLivraison === 'LIVRAISON' && (
                <Pressable
                  style={styles.boutonSecondaire}
                  onPress={() =>
                    // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir RootNavigator.tsx
                    navigation.navigate('BonLivraison', { commandeId: commande.id })
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.boutonSecondaireTexte}>Bon de livraison</Text>
                </Pressable>
              )}
              {action && (
                <Pressable
                  style={styles.bouton}
                  disabled={changerStatut.isPending}
                  onPress={() => changerStatut.mutate({ id: commande.id, statut: action.statut })}
                  accessibilityRole="button"
                >
                  <Text style={styles.boutonTexte}>{action.libelle}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  filtres: { flexGrow: 0, paddingHorizontal: espacement.margeMobile, paddingVertical: 12 },
  filtre: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.full,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  filtreActif: { backgroundColor: couleurs.primary, borderColor: couleurs.primary },
  filtreActifTexte: { color: couleurs.onPrimary },
  vide: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 24 },
  carte: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 12,
    gap: 6,
    backgroundColor: couleurs.surfaceContainerLowest,
  },
  carteEntete: { flexDirection: 'row', justifyContent: 'space-between' },
  numero: { fontFamily: 'monospace', fontWeight: '600', color: couleurs.onSurface },
  statut: { color: couleurs.primary, fontWeight: '600', fontSize: 12 },
  montant: { color: couleurs.onSurfaceVariant },
  bouton: {
    backgroundColor: couleurs.secondaryContainer,
    borderRadius: rayon.lg,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  boutonTexte: { color: couleurs.primary, fontWeight: '600' },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  boutonSecondaireTexte: { color: couleurs.primary, fontWeight: '600' },
});
