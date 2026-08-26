import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import type { Commande, ModePaiement, OperationCaisse, TypeOperationCaisse } from '../lib/types';

function genererIdempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

const LIBELLES_TYPE: Record<TypeOperationCaisse, string> = {
  OUVERTURE: 'Ouverture',
  ENCAISSEMENT: 'Encaissement',
  AVANCE: 'Avance',
  DEPENSE: 'Dépense',
  REMBOURSEMENT: 'Remboursement',
  AJUSTEMENT_COMPENSATOIRE: 'Ajustement',
  CLOTURE: 'Clôture',
};

const LIBELLES_MODE: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  MOBILE_MONEY: 'Mobile Money',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  AUTRE: 'Autre',
};

const TYPES_SAISISSABLES: TypeOperationCaisse[] = [
  'ENCAISSEMENT',
  'AVANCE',
  'DEPENSE',
  'REMBOURSEMENT',
];

// Équivalent mobile de apps/web/src/pages/CashPage.tsx (021, retour de test
// manuel : parité web/mobile). Même contrat GET /caisse/solde, GET/POST
// /caisse/operations, ouvert à ADMIN/CAISSIER. Journal append-only
// (Constitution IV) : ni édition ni suppression exposées ici non plus.
export function CashScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [clotureOuverte, setClotureOuverte] = useState(false);
  const [type, setType] = useState<TypeOperationCaisse>('ENCAISSEMENT');
  const [montant, setMontant] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const solde = useQuery({
    queryKey: ['caisse-solde'],
    queryFn: () => apiFetch<{ solde: string }>('/caisse/solde', { token }),
  });
  const operations = useQuery({
    queryKey: ['caisse-operations'],
    queryFn: () => apiFetch<OperationCaisse[]>('/caisse/operations', { token }),
  });
  const commandes = useQuery({
    queryKey: ['commandes'],
    queryFn: () => apiFetch<Commande[]>('/commandes', { token }),
  });
  const numeroParCommandeId = new Map(commandes.data?.map((c) => [c.id, c.numero]));

  const operationsDuJour = useMemo(
    () => (operations.data ?? []).filter((op) => op.createdAt.slice(0, 10) === dateDuJour()),
    [operations.data],
  );
  const totalDepensesDuJour = useMemo(
    () =>
      operationsDuJour
        .filter((op) => op.type === 'DEPENSE')
        .reduce((somme, op) => somme + Number(op.montant), 0),
    [operationsDuJour],
  );
  const clotureDejaEffectuee = operationsDuJour.some((op) => op.type === 'CLOTURE');

  const enregistrerOperation = useMutation({
    mutationFn: () =>
      apiFetch<OperationCaisse>('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type,
          montant: Number(montant),
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      queryClient.invalidateQueries({ queryKey: ['caisse-solde'] });
      setFormulaireOuvert(false);
      setMontant('');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  const cloturerCaisse = useMutation({
    mutationFn: () =>
      apiFetch<OperationCaisse>('/caisse/operations', {
        method: 'POST',
        token,
        body: {
          type: 'CLOTURE',
          montant: 0,
          // Déterministe : un second appel le même jour ne duplique jamais
          // le marqueur de clôture (rejeu idempotent, cash.service.ts).
          idempotencyKey: `cloture-${dateDuJour()}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caisse-operations'] });
      setClotureOuverte(false);
    },
  });

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <Text style={typographie.headlineLg}>Journal de caisse</Text>
        <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => setFormulaireOuvert((ouvert) => !ouvert)}
            accessibilityRole="button"
            style={styles.boutonPrincipal}
          >
            <Text style={styles.boutonPrincipalTexte}>
              {formulaireOuvert ? 'Fermer' : 'Nouvelle opération'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setClotureOuverte((ouvert) => !ouvert)}
            accessibilityRole="button"
            style={styles.boutonSecondaire}
          >
            <Text style={styles.boutonSecondaireTexte}>Clôturer la caisse</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.cartesResume}>
        <View style={styles.carteSolde}>
          <Text style={styles.carteSoldeLibelle}>Solde en caisse</Text>
          <Text style={styles.carteSoldeValeur}>{solde.data?.solde ?? '—'} FCFA</Text>
        </View>
        <View style={styles.carteDepense}>
          <Text style={styles.carteDepenseLibelle}>Dépenses du jour</Text>
          <Text style={styles.carteDepenseValeur}>
            {totalDepensesDuJour.toLocaleString('fr-FR')} FCFA
          </Text>
        </View>
      </View>

      {clotureOuverte && (
        <View style={styles.formulaire}>
          <Text style={styles.titreCloture}>Clôture de caisse quotidienne</Text>
          {clotureDejaEffectuee ? (
            <Text style={styles.clotureOk}>La caisse a déjà été clôturée aujourd'hui.</Text>
          ) : (
            <>
              <Text style={styles.detailOperation}>
                Solde actuel : {solde.data?.solde ?? '—'} FCFA. Cette action enregistre un marqueur
                de clôture — le solde reste calculé normalement, aucune opération n'est modifiée.
              </Text>
              <Pressable
                onPress={() => cloturerCaisse.mutate()}
                disabled={cloturerCaisse.isPending}
                accessibilityRole="button"
                style={[styles.boutonPrincipal, cloturerCaisse.isPending && styles.boutonDesactive]}
              >
                <Text style={styles.boutonPrincipalTexte}>
                  {cloturerCaisse.isPending ? 'Clôture…' : 'Confirmer la clôture'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {formulaireOuvert && (
        <View style={styles.formulaire}>
          <View style={styles.selecteurType}>
            {TYPES_SAISISSABLES.map((valeur) => (
              <Pressable
                key={valeur}
                onPress={() => setType(valeur)}
                style={[styles.puceType, type === valeur && styles.puceTypeActive]}
              >
                <Text style={[styles.puceTypeTexte, type === valeur && styles.puceTypeTexteActive]}>
                  {LIBELLES_TYPE[valeur]}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.champ}
            placeholder="Montant"
            accessibilityLabel="Montant"
            keyboardType="numeric"
            value={montant}
            onChangeText={setMontant}
          />
          {erreur && <Text style={styles.erreur}>{erreur}</Text>}
          <Pressable
            onPress={() => enregistrerOperation.mutate()}
            disabled={enregistrerOperation.isPending || !montant}
            accessibilityRole="button"
            style={[
              styles.boutonPrincipal,
              (enregistrerOperation.isPending || !montant) && styles.boutonDesactive,
            ]}
          >
            <Text style={styles.boutonPrincipalTexte}>
              {enregistrerOperation.isPending ? 'Enregistrement…' : "Enregistrer l'opération"}
            </Text>
          </Pressable>
        </View>
      )}

      {operations.isPending && (
        <ActivityIndicator style={{ marginTop: 24 }} color={couleurs.primary} />
      )}

      <FlatList
        data={operations.data ?? []}
        keyExtractor={(operation) => operation.id}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          !operations.isPending ? (
            <Text style={styles.videTexte}>Aucune opération pour l'instant.</Text>
          ) : null
        }
        renderItem={({ item: operation }) => (
          <View style={styles.ligneOperation}>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeOperation}>{LIBELLES_TYPE[operation.type]}</Text>
              <Text style={styles.detailOperation}>
                {new Date(operation.createdAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {operation.modePaiement ? ` · ${LIBELLES_MODE[operation.modePaiement]}` : ''}
                {operation.commandeId && numeroParCommandeId.has(operation.commandeId)
                  ? ` · #${numeroParCommandeId.get(operation.commandeId)}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.montantOperation}>{operation.montant} FCFA</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background, padding: espacement.margeMobile },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  boutonPrincipal: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonPrincipalTexte: { color: couleurs.onPrimary, fontWeight: '600', fontSize: 13 },
  boutonSecondaire: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boutonSecondaireTexte: { color: couleurs.onSurface, fontWeight: '600', fontSize: 13 },
  titreCloture: { fontWeight: '700', color: couleurs.onSurface },
  clotureOk: { color: couleurs.statutTermine, fontSize: 13 },
  cartesResume: { flexDirection: 'row', gap: 8, marginTop: espacement.base },
  carteSolde: { flex: 1, backgroundColor: couleurs.primary, borderRadius: rayon.xl, padding: 14 },
  carteSoldeLibelle: { fontSize: 11, color: couleurs.onPrimary, opacity: 0.8 },
  carteSoldeValeur: { fontSize: 20, fontWeight: '700', color: couleurs.onPrimary, marginTop: 4 },
  carteDepense: {
    flex: 1,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 14,
  },
  carteDepenseLibelle: { fontSize: 11, color: couleurs.onSurfaceVariant },
  carteDepenseValeur: { fontSize: 20, fontWeight: '700', color: couleurs.error, marginTop: 4 },
  formulaire: {
    marginTop: espacement.base,
    gap: 8,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
  },
  selecteurType: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puceType: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  puceTypeActive: { backgroundColor: couleurs.primary, borderColor: couleurs.primary },
  puceTypeTexte: { fontSize: 12, color: couleurs.onSurface },
  puceTypeTexteActive: { color: couleurs.onPrimary, fontWeight: '600' },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  erreur: { color: couleurs.error, fontSize: 12 },
  liste: { gap: 6, paddingTop: espacement.base, paddingBottom: 24 },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 24 },
  ligneOperation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
    gap: 8,
  },
  typeOperation: { fontWeight: '600', color: couleurs.onSurface, fontSize: 13 },
  detailOperation: { fontSize: 11, color: couleurs.onSurfaceVariant, marginTop: 2 },
  montantOperation: { fontWeight: '700', color: couleurs.onSurface },
});
