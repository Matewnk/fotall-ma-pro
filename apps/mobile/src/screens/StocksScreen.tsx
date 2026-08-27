import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import {
  COULEUR_ICONE_STOCK_PAR_DEFAUT,
  COULEUR_PAR_ICONE_STOCK,
  ICONES_STOCK,
} from '../lib/icones-stock';
import { couleurs, espacement, rayon, typographie } from '../lib/theme';
import type { ArticleStock, MouvementStock, TypeMouvementStock } from '../lib/types';

function genererIdempotencyKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function couleurIcone(icone: string | undefined): string {
  return COULEUR_PAR_ICONE_STOCK.get(icone ?? '') ?? COULEUR_ICONE_STOCK_PAR_DEFAUT;
}

const LIBELLES_MOUVEMENT: Record<TypeMouvementStock, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  AJUSTEMENT: 'Ajustement',
};
const TYPES_MOUVEMENT: TypeMouvementStock[] = ['ENTREE', 'SORTIE', 'AJUSTEMENT'];

type FormulaireArticle = {
  code: string;
  intitule: string;
  unite: string;
  seuil: string;
  icone: string;
};
const FORMULAIRE_VIDE: FormulaireArticle = {
  code: '',
  intitule: '',
  unite: '',
  seuil: '',
  icone: '',
};

// Équivalent mobile de apps/web/src/pages/StocksPage.tsx (021, retour de
// test manuel : parité web/mobile). Mêmes contrats GET/POST /stocks/
// articles, GET /stocks/articles/mouvements, POST /stocks/articles/:id/
// mouvements. Le niveau de stock affiché vient toujours du serveur
// (jamais recalculé côté client), comme sur web.
export function StocksScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const role = session?.user.role;
  const peutGererCatalogue = role === 'ADMIN';
  const peutEnregistrerMouvement = role === 'ADMIN' || role === 'TECHNICIEN';
  const queryClient = useQueryClient();

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState<FormulaireArticle>(FORMULAIRE_VIDE);
  const [articleAjuste, setArticleAjuste] = useState<string | null>(null);
  const [typeMouvement, setTypeMouvement] = useState<TypeMouvementStock>('ENTREE');
  const [direction, setDirection] = useState<'HAUSSE' | 'BAISSE'>('HAUSSE');
  const [quantiteMouvement, setQuantiteMouvement] = useState('');
  const [noteMouvement, setNoteMouvement] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const articles = useQuery({
    queryKey: ['stocks-articles'],
    queryFn: () => apiFetch<ArticleStock[]>('/stocks/articles', { token }),
  });
  const mouvements = useQuery({
    queryKey: ['stocks-mouvements'],
    queryFn: () => apiFetch<MouvementStock[]>('/stocks/articles/mouvements', { token }),
  });
  const articlesEnAlerte = articles.data?.filter((a) => a.actif && a.enAlerte) ?? [];

  const creerArticle = useMutation({
    mutationFn: () =>
      apiFetch<ArticleStock>('/stocks/articles', {
        method: 'POST',
        token,
        body: {
          code: formulaire.code,
          intitule: formulaire.intitule,
          unite: formulaire.unite,
          ...(formulaire.seuil ? { seuil: Number(formulaire.seuil) } : {}),
          ...(formulaire.icone ? { icone: formulaire.icone } : {}),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks-articles'] });
      setFormulaireOuvert(false);
      setFormulaire(FORMULAIRE_VIDE);
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  const enregistrerMouvement = useMutation({
    mutationFn: () =>
      apiFetch(`/stocks/articles/${articleAjuste}/mouvements`, {
        method: 'POST',
        token,
        body: {
          type: typeMouvement,
          quantite: Number(quantiteMouvement),
          ...(typeMouvement === 'AJUSTEMENT' ? { direction } : {}),
          ...(noteMouvement ? { note: noteMouvement } : {}),
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks-articles'] });
      queryClient.invalidateQueries({ queryKey: ['stocks-mouvements'] });
      setArticleAjuste(null);
      setQuantiteMouvement('');
      setNoteMouvement('');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Enregistrement impossible.');
    },
  });

  function ouvrirAjustement(articleId: string) {
    setErreur(null);
    setArticleAjuste((actuel) => (actuel === articleId ? null : articleId));
    setTypeMouvement('ENTREE');
    setDirection('HAUSSE');
    setQuantiteMouvement('');
    setNoteMouvement('');
  }

  return (
    <FlatList
      style={styles.conteneur}
      contentContainerStyle={styles.liste}
      data={articles.data ?? []}
      keyExtractor={(article) => article.id}
      ListHeaderComponent={
        <View style={{ gap: espacement.base }}>
          <View style={styles.entete}>
            <View>
              <Text style={typographie.headlineLg}>Stocks &amp; consommables</Text>
              <Text style={styles.sousTitre}>Gérez votre inventaire quotidien.</Text>
            </View>
            {peutGererCatalogue && (
              <Pressable
                onPress={() => setFormulaireOuvert((ouvert) => !ouvert)}
                accessibilityRole="button"
                style={styles.boutonPrincipal}
              >
                <Text style={styles.boutonPrincipalTexte}>
                  {formulaireOuvert ? 'Fermer' : 'Nouvel article'}
                </Text>
              </Pressable>
            )}
          </View>

          {articlesEnAlerte.map((article) => (
            <View key={article.id} style={styles.alerte}>
              <Text style={styles.alerteTitre}>Stock bas</Text>
              <Text style={styles.alerteTexte}>
                {article.intitule} est en dessous du seuil critique (reste : {article.quantite}{' '}
                {article.unite}, seuil {article.seuil}).
              </Text>
            </View>
          ))}

          {formulaireOuvert && (
            <View style={styles.formulaire}>
              <TextInput
                style={styles.champ}
                placeholder="Code (SKU)"
                accessibilityLabel="Code (SKU)"
                value={formulaire.code}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, code: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Intitulé"
                accessibilityLabel="Intitulé"
                value={formulaire.intitule}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, intitule: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Unité (ex. bidons (5L))"
                accessibilityLabel="Unité"
                value={formulaire.unite}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, unite: v }))}
              />
              <TextInput
                style={styles.champ}
                placeholder="Seuil d'alerte"
                accessibilityLabel="Seuil d'alerte"
                keyboardType="numeric"
                value={formulaire.seuil}
                onChangeText={(v) => setFormulaire((f) => ({ ...f, seuil: v }))}
              />
              <View style={styles.selecteurIcones}>
                {ICONES_STOCK.map(({ valeur, libelle, couleur }) => {
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
              <Pressable
                onPress={() => creerArticle.mutate()}
                disabled={creerArticle.isPending}
                accessibilityRole="button"
                style={[styles.boutonPrincipal, creerArticle.isPending && styles.boutonDesactive]}
              >
                <Text style={styles.boutonPrincipalTexte}>
                  {creerArticle.isPending ? 'Création…' : "Créer l'article"}
                </Text>
              </Pressable>
            </View>
          )}

          {articles.isPending && (
            <ActivityIndicator style={{ marginTop: 12 }} color={couleurs.primary} />
          )}
          {articles.data?.length === 0 && !articles.isPending && (
            <Text style={styles.videTexte}>Aucun article pour l'instant.</Text>
          )}
        </View>
      }
      renderItem={({ item: article }) => {
        const couleur = couleurIcone(article.icone);
        const pourcentage =
          article.seuil > 0 ? Math.min(100, (article.quantite / (article.seuil * 2)) * 100) : 100;
        return (
          <View style={{ gap: 6 }}>
            <View
              style={[styles.carteArticle, article.enAlerte && { borderColor: couleurs.error }]}
            >
              <View style={styles.carteArticleEntete}>
                <View style={[styles.pastilleIcone, { backgroundColor: `${couleur}1A` }]}>
                  <Text style={{ color: couleur, fontSize: 11, fontWeight: '700' }}>
                    {(article.icone ?? '?').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badgeStatut,
                    { backgroundColor: article.enAlerte ? '#ba1a1a1a' : '#10b9811a' },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: article.enAlerte ? couleurs.error : couleurs.statutTermine,
                    }}
                  >
                    {article.enAlerte ? 'STOCK BAS' : 'EN STOCK'}
                  </Text>
                </View>
              </View>
              <Text style={styles.articleIntitule}>{article.intitule}</Text>
              <Text style={styles.articleCode}>{article.code}</Text>
              <View style={styles.articleValeurLigne}>
                <Text style={styles.articleValeur}>{article.quantite}</Text>
                <Text style={styles.articleUnite}>{article.unite}</Text>
              </View>
              <View style={styles.barreProgression}>
                <View
                  style={[
                    styles.barreProgressionRemplie,
                    {
                      width: `${pourcentage}%`,
                      backgroundColor: article.enAlerte ? couleurs.error : couleurs.statutTermine,
                    },
                  ]}
                />
              </View>
              <Text style={styles.articleSeuil}>Seuil : {article.seuil}</Text>

              {peutEnregistrerMouvement && (
                <Pressable
                  onPress={() => ouvrirAjustement(article.id)}
                  accessibilityRole="button"
                  style={styles.boutonSecondaire}
                >
                  <Text style={styles.boutonSecondaireTexte}>Ajuster</Text>
                </Pressable>
              )}
            </View>

            {articleAjuste === article.id && (
              <View style={styles.formulaire}>
                <View style={styles.selecteurType}>
                  {TYPES_MOUVEMENT.map((valeur) => (
                    <Pressable
                      key={valeur}
                      onPress={() => setTypeMouvement(valeur)}
                      style={[styles.puceType, typeMouvement === valeur && styles.puceTypeActive]}
                    >
                      <Text
                        style={[
                          styles.puceTypeTexte,
                          typeMouvement === valeur && styles.puceTypeTexteActive,
                        ]}
                      >
                        {LIBELLES_MOUVEMENT[valeur]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {typeMouvement === 'AJUSTEMENT' && (
                  <View style={styles.selecteurType}>
                    {(['HAUSSE', 'BAISSE'] as const).map((valeur) => (
                      <Pressable
                        key={valeur}
                        onPress={() => setDirection(valeur)}
                        style={[styles.puceType, direction === valeur && styles.puceTypeActive]}
                      >
                        <Text
                          style={[
                            styles.puceTypeTexte,
                            direction === valeur && styles.puceTypeTexteActive,
                          ]}
                        >
                          {valeur === 'HAUSSE' ? 'Hausse' : 'Baisse'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={styles.champ}
                  placeholder="Quantité"
                  accessibilityLabel="Quantité"
                  keyboardType="numeric"
                  value={quantiteMouvement}
                  onChangeText={setQuantiteMouvement}
                />
                <TextInput
                  style={styles.champ}
                  placeholder="Note (optionnel)"
                  accessibilityLabel="Note"
                  value={noteMouvement}
                  onChangeText={setNoteMouvement}
                />
                {erreur && <Text style={styles.erreur}>{erreur}</Text>}
                <Pressable
                  onPress={() => enregistrerMouvement.mutate()}
                  disabled={enregistrerMouvement.isPending || !quantiteMouvement}
                  accessibilityRole="button"
                  style={[
                    styles.boutonPrincipal,
                    (enregistrerMouvement.isPending || !quantiteMouvement) &&
                      styles.boutonDesactive,
                  ]}
                >
                  <Text style={styles.boutonPrincipalTexte}>
                    {enregistrerMouvement.isPending ? 'Enregistrement…' : 'Confirmer'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      }}
      ListFooterComponent={
        <View style={styles.blocMouvements}>
          <Text style={styles.blocMouvementsTitre}>Mouvements récents</Text>
          {mouvements.data?.length === 0 && (
            <Text style={styles.videTexte}>Aucun mouvement pour l'instant.</Text>
          )}
          {mouvements.data?.map((mouvement) => (
            <View key={mouvement.id} style={styles.ligneMouvement}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mouvementArticle}>{mouvement.article.intitule}</Text>
                <Text style={styles.mouvementDetail}>
                  {new Date(mouvement.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {LIBELLES_MOUVEMENT[mouvement.type]}
                  {mouvement.note ? ` · ${mouvement.note}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.mouvementQuantite,
                  { color: mouvement.quantite < 0 ? couleurs.error : couleurs.statutTermine },
                ]}
              >
                {mouvement.quantite > 0 ? '+' : ''}
                {mouvement.quantite}
              </Text>
            </View>
          ))}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.background },
  liste: { padding: espacement.margeMobile, gap: 10, paddingBottom: 24 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sousTitre: { fontSize: 12, color: couleurs.onSurfaceVariant, marginTop: 2 },
  boutonPrincipal: {
    backgroundColor: couleurs.primary,
    borderRadius: rayon.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonPrincipalTexte: { color: couleurs.onPrimary, fontWeight: '600', fontSize: 13 },
  boutonSecondaire: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  boutonSecondaireTexte: { color: couleurs.onSurface, fontWeight: '600', fontSize: 12 },
  alerte: {
    backgroundColor: '#ba1a1a14',
    borderWidth: 1,
    borderColor: '#ba1a1a33',
    borderRadius: rayon.lg,
    padding: 12,
  },
  alerteTitre: { color: couleurs.error, fontWeight: '700', fontSize: 13 },
  alerteTexte: { color: couleurs.onSurfaceVariant, fontSize: 12, marginTop: 2 },
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
  videTexte: { color: couleurs.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
  carteArticle: {
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.xl,
    padding: 14,
  },
  carteArticleEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastilleIcone: {
    width: 32,
    height: 32,
    borderRadius: rayon.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStatut: { borderRadius: rayon.full, paddingHorizontal: 8, paddingVertical: 3 },
  articleIntitule: { fontWeight: '600', color: couleurs.onSurface, marginTop: 8 },
  articleCode: { fontSize: 11, color: couleurs.onSurfaceVariant, marginTop: 2 },
  articleValeurLigne: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
  articleValeur: { fontSize: 24, fontWeight: '700', color: couleurs.onSurface },
  articleUnite: { fontSize: 12, color: couleurs.onSurfaceVariant, paddingBottom: 3 },
  barreProgression: {
    width: '100%',
    height: 6,
    borderRadius: rayon.full,
    backgroundColor: couleurs.surfaceContainerHigh,
    marginTop: 6,
    overflow: 'hidden',
  },
  barreProgressionRemplie: { height: 6, borderRadius: rayon.full },
  articleSeuil: { fontSize: 11, color: couleurs.onSurfaceVariant, marginTop: 6 },
  blocMouvements: {
    marginTop: 8,
    backgroundColor: couleurs.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: couleurs.outlineVariant,
    borderRadius: rayon.lg,
    padding: 12,
    gap: 8,
  },
  blocMouvementsTitre: { fontWeight: '700', color: couleurs.onSurface, fontSize: 14 },
  ligneMouvement: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: couleurs.outlineVariant,
    paddingTop: 8,
    gap: 8,
  },
  mouvementArticle: { fontSize: 13, fontWeight: '600', color: couleurs.onSurface },
  mouvementDetail: { fontSize: 11, color: couleurs.onSurfaceVariant, marginTop: 2 },
  mouvementQuantite: { fontWeight: '700', fontFamily: 'monospace' },
});
