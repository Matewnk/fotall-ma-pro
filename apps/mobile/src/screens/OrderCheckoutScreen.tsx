import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';
import type { Client, Commande, ModePaiement, OperationCaisse, Service } from '../lib/types';

// Écran §order-to-cash (mobile) — maquette de référence :
// docs/design/screens/encaissement_commande_mobile. Le total affiché vient
// TOUJOURS de la commande (décision #5) : le caissier ne saisit jamais le
// total, seulement le montant reçu (décision #6). Le serveur recalcule et
// valide tout (décisions #4/#7/#8) — cet écran n'est qu'une présentation.
export function OrderCheckoutScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commandeId } = route.params as { commandeId: string };
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  const commande = useQuery({
    queryKey: ['commande', commandeId],
    queryFn: () => apiFetch<Commande>(`/commandes/${commandeId}`, { token }),
  });
  const client = useQuery({
    queryKey: ['client', commande.data?.clientId],
    queryFn: () => apiFetch<Client>(`/clients/${commande.data?.clientId}`, { token }),
    enabled: !!commande.data?.clientId,
  });
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });
  const servicesParId = new Map(services.data?.map((service) => [service.id, service]));

  // Indication d'affichage uniquement : la garantie réelle contre le
  // double encaissement est côté serveur (409, cash.service.ts).
  const operations = useQuery({
    queryKey: ['caisse-operations', 'ENCAISSEMENT'],
    queryFn: () => apiFetch<OperationCaisse[]>('/caisse/operations?type=ENCAISSEMENT', { token }),
  });
  const dejaEncaissee = useMemo(
    () => operations.data?.some((operation) => operation.commandeId === commandeId) ?? false,
    [operations.data, commandeId],
  );

  const [montantRecu, setMontantRecu] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const total = commande.data ? Number(commande.data.total) : 0;
  const montantRecuNombre = Number(montantRecu || 0);
  const monnaie = montantRecu ? montantRecuNombre - total : null;

  const encaisser = useMutation({
    mutationFn: () =>
      apiFetch<OperationCaisse & { monnaie?: string }>('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type: 'ENCAISSEMENT',
          commandeId,
          montantRecu: montantRecuNombre,
          modePaiement: 'ESPECES' satisfies ModePaiement,
          // Déterministe : un rejeu réseau du même clic ne duplique jamais
          // l'écriture (idempotence, cash.service.ts).
          idempotencyKey: `encaissement-${commandeId}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-solde'] });
      setErreur(null);
      // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir RootNavigator.tsx
      navigation.navigate('NouvelleCommande');
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Encaissement impossible.');
    },
  });

  function handleEncaisser() {
    setErreur(null);
    if (montantRecuNombre < total) {
      setErreur(`Montant reçu insuffisant : ${total} FCFA dus.`);
      return;
    }
    encaisser.mutate();
  }

  if (commande.isPending) {
    return (
      <View style={styles.conteneur}>
        <ActivityIndicator />
      </View>
    );
  }
  if (commande.isError || !commande.data) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.erreur}>Commande introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ gap: espacement.gutter }}>
      <View style={styles.carte}>
        <View style={styles.ligneEntete}>
          <Text style={styles.numero}>#{commande.data.numero}</Text>
        </View>
        <Text style={styles.client}>{client.data?.nom ?? '—'}</Text>
        <View style={styles.recapitulatif}>
          <Text style={styles.section}>RÉCAPITULATIF</Text>
          {commande.data.articles?.map((article) => (
            <View key={article.id} style={styles.ligneListe}>
              <Text>
                {servicesParId.get(article.serviceId)?.intitule ?? article.serviceId} (x
                {article.quantite})
              </Text>
              <Text>{article.sousTotal} FCFA</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.totalCarte}>
        <Text style={styles.totalLabel}>TOTAL À ENCAISSER</Text>
        <Text style={styles.totalMontant}>{commande.data.total} FCFA</Text>
      </View>

      {dejaEncaissee ? (
        <Text style={styles.confirmation}>Cette commande est déjà encaissée.</Text>
      ) : (
        <>
          <View style={styles.carte}>
            <Text style={styles.section}>MONTANT REÇU</Text>
            <TextInput
              style={styles.champ}
              placeholder="0"
              keyboardType="numeric"
              accessibilityLabel="Montant reçu"
              value={montantRecu}
              onChangeText={setMontantRecu}
            />
            <View style={styles.ligneListe}>
              <Text>Monnaie à rendre</Text>
              <Text style={styles.monnaie}>{monnaie !== null ? `${monnaie} FCFA` : '—'}</Text>
            </View>
          </View>

          {erreur && <Text style={styles.erreur}>{erreur}</Text>}

          <Pressable
            style={[styles.bouton, (encaisser.isPending || !montantRecu) && styles.boutonDesactive]}
            disabled={encaisser.isPending || !montantRecu}
            onPress={handleEncaisser}
            accessibilityRole="button"
          >
            {encaisser.isPending ? (
              <ActivityIndicator color={couleurs.onPrimary} />
            ) : (
              <Text style={styles.boutonTexte}>ENCAISSER</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: espacement.margeMobile, backgroundColor: couleurs.background },
  carte: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 16,
  },
  ligneEntete: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  numero: { fontFamily: 'monospace', color: couleurs.primary },
  client: { fontWeight: '600', marginBottom: 8, color: couleurs.onSurface },
  recapitulatif: {
    borderTopWidth: 1,
    borderTopColor: couleurs.outlineVariant,
    paddingTop: 8,
    gap: 4,
  },
  section: { fontSize: 12, fontWeight: '700', color: couleurs.onSurfaceVariant, marginBottom: 6 },
  ligneListe: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalCarte: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.xl,
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    color: couleurs.secondaryContainer,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalMontant: { color: couleurs.onPrimary, fontSize: 32, fontWeight: '700' },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    textAlign: 'right',
    fontSize: 18,
  },
  monnaie: { fontWeight: '700', fontSize: 16, color: couleurs.onSurface },
  confirmation: { color: couleurs.statutTermine, fontWeight: '600', textAlign: 'center' },
  erreur: { color: couleurs.error, fontSize: 13 },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  boutonDesactive: { opacity: 0.5 },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
});
