import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { COULEUR_ICONE_PAR_DEFAUT, COULEUR_PAR_ICONE, ICONES_SERVICE } from '../lib/icones-service';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { Service } from '../lib/types';

type FormulaireService = {
  code: string;
  intitule: string;
  categorie: string;
  delaiHeures: string;
  tarif: string;
  icone: string;
};
const FORMULAIRE_VIDE: FormulaireService = {
  code: '',
  intitule: '',
  categorie: '',
  delaiHeures: '',
  tarif: '',
  icone: '',
};

// Équivalent mobile de apps/web/src/pages/ServicesPage.tsx (021, retour de
// test manuel : parité web/mobile). Même contrat GET/POST/PATCH/DELETE
// /services ; création/édition/suppression réservées à ADMIN (lecture
// ouverte à ADMIN+CAISSIER, cf. services.controller.ts).
export function ServicesScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const peutGerer = session?.user.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [serviceEnEdition, setServiceEnEdition] = useState<Service | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireService>(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });
  const categories = new Set(services.data?.map((s) => s.categorie)).size;

  function ouvrirCreation() {
    setServiceEnEdition(null);
    setFormulaire(FORMULAIRE_VIDE);
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function ouvrirEdition(service: Service) {
    setServiceEnEdition(service);
    setFormulaire({
      code: service.code,
      intitule: service.intitule,
      categorie: service.categorie,
      delaiHeures: service.delaiHeures !== undefined ? String(service.delaiHeures) : '',
      tarif: service.tarif,
      icone: service.icone ?? '',
    });
    setErreur(null);
    setFormulaireOuvert(true);
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setServiceEnEdition(null);
  }

  const enregistrerService = useMutation({
    mutationFn: () => {
      const base = {
        intitule: formulaire.intitule,
        categorie: formulaire.categorie,
        tarif: Number(formulaire.tarif),
        ...(formulaire.delaiHeures ? { delaiHeures: Number(formulaire.delaiHeures) } : {}),
        ...(formulaire.icone ? { icone: formulaire.icone } : {}),
      };
      return serviceEnEdition
        ? apiFetch<Service>(`/services/${serviceEnEdition.id}`, {
            method: 'PATCH',
            token,
            body: base,
          })
        : apiFetch<Service>('/services', {
            method: 'POST',
            token,
            body: { ...base, code: formulaire.code },
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      fermerFormulaire();
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  const supprimerService = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/services/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  function confirmerSuppression(service: Service) {
    Alert.alert('Supprimer ce service ?', service.intitule, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => supprimerService.mutate(service.id),
      },
    ]);
  }

  return (
    <FlatList
      style={styles.conteneur}
      contentContainerStyle={styles.liste}
      data={services.data ?? []}
      keyExtractor={(service) => service.id}
      ListHeaderComponent={
        <View style={{ gap: espacement.base }}>
          <View style={styles.entete}>
            <Text style={typographie.headlineLg}>Tarifs &amp; services</Text>
            {peutGerer && (
              <Pressable
                onPress={formulaireOuvert ? fermerFormulaire : ouvrirCreation}
                accessibilityRole="button"
                style={styles.boutonPrincipal}
              >
                <Text style={styles.boutonPrincipalTexte}>
                  {formulaireOuvert ? 'Fermer' : 'Ajouter un service'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.cartesResume}>
            <View style={styles.carteKpi}>
              <Text style={styles.carteKpiLibelle}>Services actifs</Text>
              <Text style={styles.carteKpiValeur}>
                {services.data?.filter((s) => s.actif).length ?? 0}
              </Text>
            </View>
            <View style={styles.carteKpi}>
              <Text style={styles.carteKpiLibelle}>Catégories</Text>
              <Text style={styles.carteKpiValeur}>{categories}</Text>
            </View>
          </View>

          {formulaireOuvert && (
            <View style={styles.formulaire}>
              {!serviceEnEdition && (
                <TextInput
                  style={styles.champ}
                  placeholder="Code (ex. SRV-01)"
                  accessibilityLabel="Code"
                  value={formulaire.code}
                  onChangeText={(v) => setFormulaire((f) => ({ ...f, code: v }))}
                />
              )}
              <TextInput
                style={styles.champ}
                placeholder="Intitulé"
                accessibilityLabel="Intitulé"
                value={formulaire.intitule}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, intitule: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Catégorie"
                accessibilityLabel="Catégorie"
                value={formulaire.categorie}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, categorie: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Délai (heures)"
                accessibilityLabel="Délai en heures"
                keyboardType="numeric"
                value={formulaire.delaiHeures}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, delaiHeures: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Tarif (FCFA)"
                accessibilityLabel="Tarif"
                keyboardType="numeric"
                value={formulaire.tarif}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, tarif: v }))}
              />
              <View style={styles.selecteurIcones}>
                {ICONES_SERVICE.map(({ valeur, libelle, couleur }) => {
                  const selectionne = formulaire.icone === valeur;
                  return (
                    <Pressable
                      key={valeur}
                      accessibilityRole="button"
                      accessibilityLabel={libelle}
                      onPress={() =>
                        setFormulaire((f) => ({ ...f, icone: f.icone === valeur ? '' : valeur }))
                      }
                      style={[
                        styles.puceIcone,
                        {
                          borderColor: couleur,
                          backgroundColor: selectionne ? couleur : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 10, color: selectionne ? '#fff' : couleur }}>
                        {libelle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {erreur && <Text style={styles.erreur}>{erreur}</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => enregistrerService.mutate()}
                  disabled={enregistrerService.isPending}
                  accessibilityRole="button"
                  style={[
                    styles.boutonPrincipal,
                    enregistrerService.isPending && styles.boutonDesactive,
                  ]}
                >
                  <Text style={styles.boutonPrincipalTexte}>
                    {enregistrerService.isPending
                      ? 'Enregistrement…'
                      : serviceEnEdition
                        ? 'Mettre à jour'
                        : 'Créer le service'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={fermerFormulaire}
                  accessibilityRole="button"
                  style={styles.boutonSecondaire}
                >
                  <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          )}

          {services.isPending && <Text style={styles.videTexte}>Chargement…</Text>}
          {services.data?.length === 0 && !services.isPending && (
            <Text style={styles.videTexte}>Aucun service pour l'instant.</Text>
          )}
        </View>
      }
      renderItem={({ item: service }) => {
        const couleurIcone = COULEUR_PAR_ICONE.get(service.icone ?? '') ?? COULEUR_ICONE_PAR_DEFAUT;
        return (
          <View style={styles.ligneService}>
            <View style={[styles.pastilleIcone, { backgroundColor: `${couleurIcone}1A` }]}>
              <Text style={{ color: couleurIcone, fontSize: 11, fontWeight: '700' }}>
                {(service.icone ?? '?').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceIntitule}>{service.intitule}</Text>
              <Text style={styles.serviceDetail}>
                {service.categorie} · {service.code} · {service.tarif} FCFA
              </Text>
              <View
                style={[
                  styles.badgeStatut,
                  { backgroundColor: service.actif ? '#6366f11a' : '#f59e0b1a' },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: service.actif ? couleurs.statutLivre : couleurs.statutEnAttente,
                  }}
                >
                  {service.actif ? 'ACTIF' : 'INACTIF'}
                </Text>
              </View>
            </View>
            {peutGerer && (
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <Pressable onPress={() => ouvrirEdition(service)} accessibilityRole="button">
                  <Text style={styles.lienModifier}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => confirmerSuppression(service)} accessibilityRole="button">
                  <Text style={styles.lienSupprimer}>Supprimer</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  liste: { padding: espacement.margeMobile, gap: 10, paddingBottom: 24 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  cartesResume: { flexDirection: 'row', gap: 8 },
  carteKpi: {
    flex: 1,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 14,
  },
  carteKpiLibelle: { fontSize: 11, color: couleurs.onSurfaceVariant, textTransform: 'uppercase' },
  carteKpiValeur: { fontSize: 20, fontWeight: '700', color: couleurs.onSurface, marginTop: 4 },
  formulaire: {
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
  selecteurIcones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puceIcone: {
    borderWidth: 1,
    borderRadius: rayon.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
  ligneService: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
  },
  pastilleIcone: {
    width: 32,
    height: 32,
    borderRadius: rayon.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIntitule: { fontWeight: '600', color: couleurs.onSurface, fontSize: 13 },
  serviceDetail: { fontSize: 11, color: couleurs.onSurfaceVariant, marginTop: 2 },
  badgeStatut: {
    alignSelf: 'flex-start',
    borderRadius: rayon.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  lienModifier: { color: couleurs.primary, fontSize: 12, fontWeight: '600' },
  lienSupprimer: { color: couleurs.error, fontSize: 12, fontWeight: '600' },
});
