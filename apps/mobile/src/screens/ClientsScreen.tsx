import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { CanalNotification, Client } from '../lib/types';

type FormulaireClient = {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
};

const FORMULAIRE_VIDE: FormulaireClient = { nom: '', telephone: '', email: '', adresse: '' };

// Équivalent mobile de apps/web/src/pages/ClientsPage.tsx (021, retour de
// test manuel : parité web/mobile). Même contrat GET/POST/PATCH/DELETE
// /clients, ouvert à ADMIN/CAISSIER. Canal de notification omis du
// formulaire (peu pertinent en saisie rapide terrain) — reste modifiable
// depuis le web si besoin.
export function ClientsScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState('');
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [clientEnEdition, setClientEnEdition] = useState<Client | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireClient>(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ['clients', recherche],
    queryFn: () =>
      apiFetch<Client[]>(`/clients${recherche ? `?nom=${encodeURIComponent(recherche)}` : ''}`, {
        token,
      }),
  });

  function ouvrirCreation() {
    setClientEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(client: Client) {
    setClientEnEdition(client);
    setFormulaire({
      nom: client.nom,
      telephone: client.telephone,
      email: client.email ?? '',
      adresse: client.adresse ?? '',
    });
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setClientEnEdition(null);
  }

  const enregistrerClient = useMutation({
    mutationFn: () => {
      const corps: {
        nom: string;
        telephone: string;
        email?: string;
        adresse?: string;
        canalNotification?: CanalNotification;
      } = {
        nom: formulaire.nom,
        telephone: formulaire.telephone,
        ...(formulaire.email ? { email: formulaire.email } : {}),
        ...(formulaire.adresse ? { adresse: formulaire.adresse } : {}),
      };
      return clientEnEdition
        ? apiFetch<Client>(`/clients/${clientEnEdition.id}`, {
            method: 'PATCH',
            token,
            body: corps,
          })
        : apiFetch<Client>('/clients', { method: 'POST', token, body: corps });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      fermerFormulaire();
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  const supprimerClient = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clients/${id}`, { method: 'DELETE', token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  function confirmerSuppression(client: Client) {
    Alert.alert('Supprimer', `Supprimer ${client.nom} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => supprimerClient.mutate(client.id) },
    ]);
  }

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <View>
          <Text style={typographie.headlineLg}>Clients</Text>
          <Text style={styles.compteur}>{clients.data?.length ?? 0} client(s) enregistré(s)</Text>
        </View>
        <Pressable
          onPress={formulaireOuvert ? fermerFormulaire : ouvrirCreation}
          accessibilityRole="button"
          style={styles.boutonPrincipal}
        >
          <Text style={styles.boutonPrincipalTexte}>
            {formulaireOuvert ? 'Fermer' : 'Nouveau client'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.champRecherche}
        placeholder="Rechercher (nom)…"
        value={recherche}
        onChangeText={setRecherche}
        accessibilityLabel="Rechercher un client"
      />

      {formulaireOuvert && (
        <View style={styles.formulaire}>
          <TextInput
            style={styles.champ}
            placeholder="Nom"
            accessibilityLabel="Nom"
            value={formulaire.nom}
            onChangeText={(valeur) => setFormulaire((f) => ({ ...f, nom: valeur }))}
          />
          <TextInput
            style={styles.champ}
            placeholder="Téléphone"
            accessibilityLabel="Téléphone"
            value={formulaire.telephone}
            onChangeText={(valeur) => setFormulaire((f) => ({ ...f, telephone: valeur }))}
          />
          <TextInput
            style={styles.champ}
            placeholder="Email (optionnel)"
            accessibilityLabel="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formulaire.email}
            onChangeText={(valeur) => setFormulaire((f) => ({ ...f, email: valeur }))}
          />
          <TextInput
            style={styles.champ}
            placeholder="Adresse (optionnel)"
            accessibilityLabel="Adresse"
            value={formulaire.adresse}
            onChangeText={(valeur) => setFormulaire((f) => ({ ...f, adresse: valeur }))}
          />
          {erreur && <Text style={styles.erreur}>{erreur}</Text>}
          <Pressable
            onPress={() => enregistrerClient.mutate()}
            disabled={enregistrerClient.isPending || !formulaire.nom || !formulaire.telephone}
            accessibilityRole="button"
            style={[
              styles.boutonPrincipal,
              (enregistrerClient.isPending || !formulaire.nom || !formulaire.telephone) &&
                styles.boutonDesactive,
            ]}
          >
            <Text style={styles.boutonPrincipalTexte}>
              {enregistrerClient.isPending
                ? 'Enregistrement…'
                : clientEnEdition
                  ? 'Mettre à jour'
                  : 'Créer le client'}
            </Text>
          </Pressable>
        </View>
      )}

      {clients.isPending && (
        <ActivityIndicator style={{ marginTop: 24 }} color={couleurs.primary} />
      )}

      <FlatList
        data={clients.data ?? []}
        keyExtractor={(client) => client.id}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          !clients.isPending ? (
            <Text style={styles.videTexte}>Aucun client pour l'instant.</Text>
          ) : null
        }
        renderItem={({ item: client }) => (
          <View style={styles.carteClient}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nomClient}>{client.nom}</Text>
              <Text style={styles.telephoneClient}>{client.telephone}</Text>
              {client.email && <Text style={styles.emailClient}>{client.email}</Text>}
            </View>
            <View style={styles.actionsClient}>
              <Pressable onPress={() => ouvrirEdition(client)} accessibilityRole="button">
                <Text style={styles.lienModifier}>Modifier</Text>
              </Pressable>
              <Pressable onPress={() => confirmerSuppression(client)} accessibilityRole="button">
                <Text style={styles.lienSupprimer}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background, padding: espacement.margeMobile },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  compteur: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 2 },
  boutonPrincipal: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonPrincipalTexte: { color: couleurs.onPrimary, fontWeight: '600', fontSize: 13 },
  champRecherche: {
    marginTop: espacement.base,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: couleurs.surfaceContainerLowest,
  },
  formulaire: {
    marginTop: espacement.base,
    gap: 8,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
  },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: couleurs.error, fontSize: 12 },
  liste: { gap: 8, paddingTop: espacement.base, paddingBottom: 24 },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 24 },
  carteClient: {
    flexDirection: 'row',
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
    gap: 8,
  },
  nomClient: { fontWeight: '600', color: couleurs.onSurface },
  telephoneClient: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 2 },
  emailClient: { fontSize: 12, color: couleurs.onSurfaceVariant },
  actionsClient: { justifyContent: 'center', gap: 8 },
  lienModifier: { color: couleurs.primary, fontSize: 12, fontWeight: '600' },
  lienSupprimer: { color: couleurs.error, fontSize: 12, fontWeight: '600' },
});
