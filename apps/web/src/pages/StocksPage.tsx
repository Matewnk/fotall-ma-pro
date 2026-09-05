import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import {
  COULEUR_ICONE_STOCK_PAR_DEFAUT,
  COULEUR_PAR_ICONE_STOCK,
  ICONE_STOCK_PAR_DEFAUT,
  ICONES_STOCK,
} from '../lib/icones-stock';
import type { ArticleStock, MouvementStock, TypeMouvementStock } from '../lib/types';

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

function couleurIcone(icone: string | undefined): string {
  return COULEUR_PAR_ICONE_STOCK.get(icone ?? '') ?? COULEUR_ICONE_STOCK_PAR_DEFAUT;
}

const LIBELLES_MOUVEMENT: Record<TypeMouvementStock, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  AJUSTEMENT: 'Ajustement',
};

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

// Écran gestion des stocks & consommables — maquette de référence :
// docs/design/screens/gestion_des_stocks_consommables. L'auto-reorder et
// la gestion de fournisseurs de la maquette ne sont pas repris : aucun
// module fournisseur/commande automatique n'existe dans ce projet. Le
// niveau de stock affiché vient toujours du serveur (jamais recalculé
// côté client) — voir stocks.service.ts.
export function StocksPage() {
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

  function handleCreerArticle(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    creerArticle.mutate();
  }

  function ouvrirAjustement(articleId: string) {
    setErreur(null);
    setArticleAjuste((actuel) => (actuel === articleId ? null : articleId));
    setTypeMouvement('ENTREE');
    setDirection('HAUSSE');
    setQuantiteMouvement('');
    setNoteMouvement('');
  }

  function handleEnregistrerMouvement(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    enregistrerMouvement.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-background">Stocks &amp; Consommables</h1>
          <p className="text-sm text-on-surface-variant">Gérez votre inventaire quotidien.</p>
        </div>
        {peutGererCatalogue && (
          <button
            type="button"
            onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}
            className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            <span className="material-symbols-outlined">add</span>
            Nouvel article
          </button>
        )}
      </div>

      {articlesEnAlerte.length > 0 && (
        <div className="flex flex-col gap-2">
          {articlesEnAlerte.map((article) => (
            <div
              key={article.id}
              className="bg-error-container/20 border border-error/20 rounded-lg p-4 flex items-start gap-3"
            >
              <span className="material-symbols-outlined text-error mt-0.5">warning</span>
              <div>
                <h4 className="font-semibold text-error">Stock bas</h4>
                <p className="text-sm text-on-surface-variant mt-1">
                  {article.intitule} est en dessous du seuil critique (reste : {article.quantite}{' '}
                  {article.unite}, seuil {article.seuil}).
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {formulaireOuvert && (
        <form
          onSubmit={handleCreerArticle}
          className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Code (SKU)
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                placeholder="DET-05L-PRO"
                value={formulaire.code}
                onChange={(event) => setFormulaire((f) => ({ ...f, code: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Intitulé
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.intitule}
                onChange={(event) => setFormulaire((f) => ({ ...f, intitule: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Unité
              <input
                className="border border-outline-variant rounded-lg px-3 py-2"
                placeholder="bidons (5L)"
                value={formulaire.unite}
                onChange={(event) => setFormulaire((f) => ({ ...f, unite: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Seuil d'alerte
              <input
                type="number"
                min={0}
                className="border border-outline-variant rounded-lg px-3 py-2"
                value={formulaire.seuil}
                onChange={(event) => setFormulaire((f) => ({ ...f, seuil: event.target.value }))}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm">Icône</span>
            <div className="flex flex-wrap gap-2">
              {ICONES_STOCK.map(({ valeur, libelle, couleur }) => {
                const selectionne = formulaire.icone === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    title={libelle}
                    aria-label={libelle}
                    aria-pressed={selectionne}
                    onClick={() =>
                      setFormulaire((f) => ({ ...f, icone: f.icone === valeur ? '' : valeur }))
                    }
                    style={
                      selectionne
                        ? { backgroundColor: couleur, borderColor: couleur }
                        : { borderColor: `${couleur}55` }
                    }
                    className="w-10 h-10 flex items-center justify-center rounded-lg border transition-colors"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: selectionne ? '#ffffff' : couleur }}
                    >
                      {valeur}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {erreur && <p className="text-sm text-error">{erreur}</p>}

          <button
            type="submit"
            disabled={creerArticle.isPending}
            className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {creerArticle.isPending ? 'Création…' : "Créer l'article"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.isPending && <p className="text-sm text-on-surface-variant">Chargement…</p>}
        {articles.data?.length === 0 && (
          <p className="text-sm text-on-surface-variant">Aucun article pour l'instant.</p>
        )}
        {articles.data?.map((article) => {
          const couleur = couleurIcone(article.icone);
          const pourcentage =
            article.seuil > 0 ? Math.min(100, (article.quantite / (article.seuil * 2)) * 100) : 100;
          return (
            <div key={article.id} className="flex flex-col gap-2">
              <div
                className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border"
                style={{
                  borderColor: article.enAlerte ? '#ba1a1a4d' : 'var(--color-outline-variant)',
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${couleur}1A` }}
                  >
                    <span className="material-symbols-outlined" style={{ color: couleur }}>
                      {article.icone ?? ICONE_STOCK_PAR_DEFAUT}
                    </span>
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      article.enAlerte
                        ? 'bg-error/10 text-error border-error/20'
                        : 'bg-status-ready/10 text-status-ready border-status-ready/20'
                    }`}
                  >
                    {article.enAlerte ? 'STOCK BAS' : 'EN STOCK'}
                  </span>
                </div>
                <h4 className="font-semibold text-on-surface mb-1">{article.intitule}</h4>
                <p className="font-mono text-xs text-on-surface-variant mb-3">{article.code}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: article.enAlerte ? '#ba1a1a' : undefined }}
                  >
                    {article.quantite}
                  </span>
                  <span className="text-sm text-on-surface-variant pb-1">{article.unite}</span>
                </div>
                <div className="w-full bg-surface-variant rounded-full h-1.5 mb-2">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${pourcentage}%`,
                      backgroundColor: article.enAlerte ? '#ba1a1a' : '#10B981',
                    }}
                  />
                </div>
                <p className="text-xs text-on-surface-variant">Seuil : {article.seuil}</p>

                {peutEnregistrerMouvement && (
                  <button
                    type="button"
                    onClick={() => ouvrirAjustement(article.id)}
                    className="w-full mt-3 border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-surface-container-high flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                    Ajuster
                  </button>
                )}
              </div>

              {articleAjuste === article.id && (
                <form
                  onSubmit={handleEnregistrerMouvement}
                  className="bg-surface border border-outline-variant rounded-lg p-3 flex flex-col gap-2"
                >
                  <label className="flex flex-col gap-1 text-xs">
                    Type
                    <select
                      className="border border-outline-variant rounded-lg px-2 py-1.5 text-sm"
                      value={typeMouvement}
                      onChange={(event) =>
                        setTypeMouvement(event.target.value as TypeMouvementStock)
                      }
                    >
                      {Object.entries(LIBELLES_MOUVEMENT).map(([valeur, libelle]) => (
                        <option key={valeur} value={valeur}>
                          {libelle}
                        </option>
                      ))}
                    </select>
                  </label>
                  {typeMouvement === 'AJUSTEMENT' && (
                    <label className="flex flex-col gap-1 text-xs">
                      Direction
                      <select
                        className="border border-outline-variant rounded-lg px-2 py-1.5 text-sm"
                        value={direction}
                        onChange={(event) =>
                          setDirection(event.target.value as 'HAUSSE' | 'BAISSE')
                        }
                      >
                        <option value="HAUSSE">Hausse</option>
                        <option value="BAISSE">Baisse</option>
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs">
                    Quantité
                    <input
                      type="number"
                      min={1}
                      className="border border-outline-variant rounded-lg px-2 py-1.5 text-sm"
                      value={quantiteMouvement}
                      onChange={(event) => setQuantiteMouvement(event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Note (optionnel)
                    <input
                      className="border border-outline-variant rounded-lg px-2 py-1.5 text-sm"
                      value={noteMouvement}
                      onChange={(event) => setNoteMouvement(event.target.value)}
                    />
                  </label>
                  {erreur && <p className="text-xs text-error">{erreur}</p>}
                  <button
                    type="submit"
                    disabled={enregistrerMouvement.isPending}
                    className="bg-primary text-on-primary rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    {enregistrerMouvement.isPending ? 'Enregistrement…' : 'Confirmer'}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <h3 className="font-semibold text-on-surface">Mouvements récents</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-on-surface-variant">
                <th className="px-4 py-2">Date &amp; heure</th>
                <th className="px-4 py-2">Article</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Quantité</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.data?.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-on-surface-variant" colSpan={5}>
                    Aucun mouvement pour l'instant.
                  </td>
                </tr>
              )}
              {mouvements.data?.map((mouvement) => (
                <tr key={mouvement.id} className="border-t border-outline-variant">
                  <td className="px-4 py-2 text-xs text-on-surface-variant">
                    {new Date(mouvement.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium">{mouvement.article.intitule}</td>
                  <td className="px-4 py-2">{LIBELLES_MOUVEMENT[mouvement.type]}</td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      mouvement.quantite < 0 ? 'text-error' : 'text-status-ready'
                    }`}
                  >
                    {mouvement.quantite > 0 ? '+' : ''}
                    {mouvement.quantite}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">{mouvement.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
