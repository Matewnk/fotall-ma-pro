import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon } from '../lib/theme';
import type { Client, Commande, ModeLivraison, Service } from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

type LigneArticle = { serviceId: string; intitule: string; tarif: string; quantite: number };

// Écran §016-mobile-offline tranche 3 (CAISSIER) — maquette de référence :
// docs/design/screens/interface_caissier_nouvelle_commande_mobile.
// Appelle l'API en ligne directement (POST /commandes, 009), comme
// LoginScreen/AccountScreen — le moteur de synchronisation offline
// (tranche 1) n'est pas encore branché sur cet écran, voir spec.md.
// Total affiché ici = estimation client (tarif × quantité), jamais
// autoritaire : le total réel est recalculé côté serveur (§9, jamais de
// confiance dans le frontend).
export function NewOrderScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const [rechercheClient, setRechercheClient] = useState('');
  const [clientSelectionne, setClientSelectionne] = useState<Client | null>(null);
  const [panier, setPanier] = useState<LigneArticle[]>([]);
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>('RETRAIT');
  const [erreur, setErreur] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ['clients', rechercheClient],
    queryFn: () =>
      apiFetch<Client[]>(
        `/clients${rechercheClient ? `?nom=${encodeURIComponent(rechercheClient)}` : ''}`,
        { token },
      ),
    enabled: rechercheClient.length > 0,
  });

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services?actif=true', { token }),
  });

  function ajouterAuPanier(service: Service) {
    setPanier((lignes) => {
      const existante = lignes.find((l) => l.serviceId === service.id);
      if (existante) {
        return lignes.map((l) =>
          l.serviceId === service.id ? { ...l, quantite: l.quantite + 1 } : l,
        );
      }
      return [
        ...lignes,
        { serviceId: service.id, intitule: service.intitule, tarif: service.tarif, quantite: 1 },
      ];
    });
  }

  function retirerDuPanier(serviceId: string) {
    setPanier((lignes) => lignes.filter((l) => l.serviceId !== serviceId));
  }

  const totalEstime = panier.reduce(
    (somme, ligne) => somme + Number(ligne.tarif) * ligne.quantite,
    0,
  );

  const creerCommande = useMutation({
    mutationFn: () => {
      if (!clientSelectionne) throw new Error('client non sélectionné');
      return apiFetch<Commande>('/commandes', {
        method: 'POST',
        token,
        body: {
          clientId: clientSelectionne.id,
          articles: panier.map((l) => ({ serviceId: l.serviceId, quantite: l.quantite })),
          modeLivraison,
          idempotencyKey: genererIdempotencyKey(),
        },
      });
    },
    onSuccess: (commande: Commande) => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setClientSelectionne(null);
      setRechercheClient('');
      setPanier([]);
      setErreur(null);
      // @ts-expect-error -- navigation non typée globalement (pas de RootParamList), voir RootNavigator.tsx
      navigation.navigate('Encaissement', { commandeId: commande.id });
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ gap: espacement.gutter }}>
      <Text style={styles.titre}>Nouvelle commande</Text>

      <View>
        <Text style={styles.section}>1. Client</Text>
        {clientSelectionne ? (
          <View style={styles.ligneSelection}>
            <Text>{clientSelectionne.nom}</Text>
            <Pressable onPress={() => setClientSelectionne(null)} accessibilityRole="button">
              <Text style={styles.lien}>Changer</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.champ}
              placeholder="Rechercher un client…"
              accessibilityLabel="Rechercher un client"
              value={rechercheClient}
              onChangeText={setRechercheClient}
            />
            {clients.data?.map((client) => (
              <Pressable
                key={client.id}
                style={styles.ligneListe}
                onPress={() => setClientSelectionne(client)}
                accessibilityRole="button"
              >
                <Text>{client.nom}</Text>
                <Text style={styles.sousTexte}>{client.telephone}</Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View>
        <Text style={styles.section}>2. Articles</Text>
        {services.data?.map((service) => (
          <Pressable
            key={service.id}
            style={styles.ligneListe}
            onPress={() => ajouterAuPanier(service)}
            accessibilityRole="button"
          >
            <Text>{service.intitule}</Text>
            <Text style={styles.sousTexte}>{service.tarif} FCFA</Text>
          </Pressable>
        ))}
      </View>

      {panier.length > 0 && (
        <View>
          <Text style={styles.section}>Panier</Text>
          {panier.map((ligne) => (
            <View key={ligne.serviceId} style={styles.ligneListe}>
              <Text>
                {ligne.quantite}x {ligne.intitule}
              </Text>
              <Pressable
                onPress={() => retirerDuPanier(ligne.serviceId)}
                accessibilityRole="button"
              >
                <Text style={styles.lien}>Retirer</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.total}>Total estimé : {totalEstime} FCFA</Text>
        </View>
      )}

      <View>
        <Text style={styles.section}>3. Mode</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['RETRAIT', 'LIVRAISON'] as ModeLivraison[]).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.choix, modeLivraison === mode && styles.choixActif]}
              onPress={() => setModeLivraison(mode)}
              accessibilityRole="button"
            >
              <Text style={modeLivraison === mode ? styles.choixActifTexte : undefined}>
                {mode === 'RETRAIT' ? 'Retrait' : 'Livraison'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      <Pressable
        style={[
          styles.bouton,
          (!clientSelectionne || panier.length === 0 || creerCommande.isPending) &&
            styles.boutonDesactive,
        ]}
        disabled={!clientSelectionne || panier.length === 0 || creerCommande.isPending}
        onPress={() => creerCommande.mutate()}
        accessibilityRole="button"
      >
        {creerCommande.isPending ? (
          <ActivityIndicator color={couleurs.onPrimary} />
        ) : (
          <Text style={styles.boutonTexte}>VALIDER LA COMMANDE</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: espacement.margeMobile, backgroundColor: couleurs.background },
  titre: { fontSize: 20, fontWeight: 'bold', color: couleurs.primary, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '600', color: couleurs.onSurfaceVariant, marginBottom: 6 },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  ligneListe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.outlineVariant,
  },
  ligneSelection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: couleurs.secondaryContainer,
    borderRadius: rayon.lg,
  },
  sousTexte: { color: couleurs.onSurfaceVariant, fontSize: 12 },
  lien: { color: couleurs.primary, fontSize: 12, fontWeight: '600' },
  total: { fontWeight: 'bold', marginTop: 8, textAlign: 'right', color: couleurs.onSurface },
  choix: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  choixActif: { backgroundColor: couleurs.primary, borderColor: couleurs.primary },
  choixActifTexte: { color: couleurs.onPrimary },
  erreur: { color: couleurs.error, fontSize: 13 },
  bouton: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  boutonDesactive: { opacity: 0.5 },
  boutonTexte: { color: couleurs.onPrimary, fontWeight: '600' },
  confirmation: { fontSize: 16, marginBottom: 16 },
});
