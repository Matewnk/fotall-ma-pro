import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LIBELLES_STATUT_COMMANDE, StatusBadge } from '../components/StatusBadge';
import { ApiError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { COULEUR_ICONE_PAR_DEFAUT, COULEUR_PAR_ICONE } from '../lib/icones-service';
import type { Client, Commande, ModeLivraison, Service, StatutCommande } from '../lib/types';

function couleurIcone(icone: string | undefined): string {
  return COULEUR_PAR_ICONE.get(icone ?? '') ?? COULEUR_ICONE_PAR_DEFAUT;
}

// EN_ATTENTE < EN_COURS < PRET < LIVRE (miroir de orders.constants.ts) :
// le statut avance d'un cran à la fois, jamais de régression — le bouton
// "Statut suivant" est le seul moyen de le faire progresser depuis cette
// liste, cohérent avec la contrainte serveur (409 sur toute régression).
const ORDRE_STATUT: StatutCommande[] = ['EN_ATTENTE', 'EN_COURS', 'PRET', 'LIVRE'];
function statutSuivant(statut: StatutCommande): StatutCommande | null {
  const index = ORDRE_STATUT.indexOf(statut);
  return index < ORDRE_STATUT.length - 1 ? (ORDRE_STATUT[index + 1] ?? null) : null;
}

function genererIdempotencyKey(): string {
  return crypto.randomUUID();
}

type LigneArticle = { serviceId: string; quantite: number };

const ICONE_PAR_DEFAUT = 'local_laundry_service';

// Écran §order-to-cash (web) — maquette de référence :
// docs/design/screens/nouvelle_commande_calcul_auto_web (panneau POS deux
// colonnes : catégories → prestations à gauche, ticket en cours à droite).
// Catégories/icônes dérivées des services réels du tenant (texte libre,
// pas d'enum) plutôt que les tuiles statiques de la maquette. Le total
// affiché est indicatif uniquement — toujours recalculé côté serveur à la
// création (orders.service.ts). La création redirige vers l'écran
// d'encaissement dédié.
export function OrdersPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const commandes = useQuery({
    queryKey: ['commandes'],
    queryFn: () => apiFetch<Commande[]>('/commandes', { token }),
  });
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiFetch<Client[]>('/clients', { token }),
  });
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<Service[]>('/services', { token }),
  });
  const servicesParId = new Map(services.data?.map((service) => [service.id, service]));
  const clientsParId = new Map(clients.data?.map((client) => [client.id, client]));
  const servicesActifs = useMemo(
    () => services.data?.filter((service) => service.actif) ?? [],
    [services.data],
  );
  const categories = useMemo(() => {
    const iconeParCategorie = new Map<string, string>();
    for (const service of servicesActifs) {
      if (!iconeParCategorie.has(service.categorie)) {
        iconeParCategorie.set(service.categorie, service.icone ?? ICONE_PAR_DEFAUT);
      }
    }
    return [...iconeParCategorie.entries()].map(([categorie, icone]) => ({ categorie, icone }));
  }, [servicesActifs]);

  const [clientId, setClientId] = useState('');
  const [nouveauClientOuvert, setNouveauClientOuvert] = useState(false);
  const [nouveauClientNom, setNouveauClientNom] = useState('');
  const [nouveauClientTelephone, setNouveauClientTelephone] = useState('');
  const [categorieActive, setCategorieActive] = useState<string | null>(null);
  const [panier, setPanier] = useState<LigneArticle[]>([]);
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>('RETRAIT');
  const [erreur, setErreur] = useState<string | null>(null);

  const [rechercheCommande, setRechercheCommande] = useState('');
  const [filtreMode, setFiltreMode] = useState<ModeLivraison | ''>('');
  const [filtreStatut, setFiltreStatut] = useState<StatutCommande | ''>('');

  const commandesFiltrees = useMemo(() => {
    const recherche = rechercheCommande.trim().toLowerCase();
    return (commandes.data ?? []).filter((commande) => {
      if (filtreMode && commande.modeLivraison !== filtreMode) return false;
      if (filtreStatut && commande.statut !== filtreStatut) return false;
      if (recherche) {
        const client = clientsParId.get(commande.clientId);
        const cible = `${client?.nom ?? ''} ${client?.telephone ?? ''}`.toLowerCase();
        if (!cible.includes(recherche)) return false;
      }
      return true;
    });
  }, [commandes.data, clientsParId, rechercheCommande, filtreMode, filtreStatut]);

  const clientActif = clients.data?.find((client) => client.id === clientId) ?? null;
  const servicesDeLaCategorie = servicesActifs.filter(
    (service) => service.categorie === categorieActive,
  );

  const totalPanier = panier.reduce((acc, ligne) => {
    const tarif = Number(servicesParId.get(ligne.serviceId)?.tarif ?? 0);
    return acc + tarif * ligne.quantite;
  }, 0);

  function ajouterAuPanier(serviceId: string) {
    setPanier((lignes) => {
      const existante = lignes.find((ligne) => ligne.serviceId === serviceId);
      if (existante) {
        return lignes.map((ligne) =>
          ligne.serviceId === serviceId ? { ...ligne, quantite: ligne.quantite + 1 } : ligne,
        );
      }
      return [...lignes, { serviceId, quantite: 1 }];
    });
  }

  function modifierQuantite(serviceId: string, delta: number) {
    setPanier((lignes) =>
      lignes
        .map((ligne) =>
          ligne.serviceId === serviceId ? { ...ligne, quantite: ligne.quantite + delta } : ligne,
        )
        .filter((ligne) => ligne.quantite > 0),
    );
  }

  function retirerDuPanier(serviceId: string) {
    setPanier((lignes) => lignes.filter((ligne) => ligne.serviceId !== serviceId));
  }

  const creerClient = useMutation({
    mutationFn: () =>
      apiFetch<Client>('/clients', {
        method: 'POST',
        token,
        body: { nom: nouveauClientNom, telephone: nouveauClientTelephone },
      }),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setClientId(client.id);
      setNouveauClientOuvert(false);
      setNouveauClientNom('');
      setNouveauClientTelephone('');
      setErreur(null);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création du client impossible.');
    },
  });

  function handleCreerClient() {
    setErreur(null);
    creerClient.mutate();
  }

  function reinitialiserFormulaire() {
    setClientId('');
    setCategorieActive(null);
    setPanier([]);
    setModeLivraison('RETRAIT');
    setErreur(null);
  }

  const creerCommande = useMutation({
    mutationFn: () =>
      apiFetch<Commande>('/commandes', {
        method: 'POST',
        token,
        body: {
          clientId,
          articles: panier.map(({ serviceId, quantite }) => ({ serviceId, quantite })),
          modeLivraison,
          idempotencyKey: genererIdempotencyKey(),
        },
      }),
    onSuccess: (commande) => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setFormulaireOuvert(false);
      reinitialiserFormulaire();
      navigate(`/commandes/${commande.id}/encaisser`);
    },
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Création impossible.');
    },
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutCommande }) =>
      apiFetch<Commande>(`/commandes/${id}/statut`, { method: 'PATCH', token, body: { statut } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commandes'] }),
    onError: (error) => {
      setErreur(error instanceof ApiError ? error.message : 'Changement de statut impossible.');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    if (!clientId) {
      setErreur('Choisissez un client.');
      return;
    }
    if (panier.length === 0) {
      setErreur('Ajoutez au moins une prestation au panier.');
      return;
    }
    creerCommande.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-on-background">Commandes</h1>
        <button
          type="button"
          onClick={() => {
            if (formulaireOuvert) reinitialiserFormulaire();
            setFormulaireOuvert((ouvert) => !ouvert);
          }}
          className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle commande
        </button>
      </div>

      {formulaireOuvert && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-outline-variant rounded-xl overflow-hidden flex flex-col lg:flex-row lg:h-[720px]"
        >
          {/* Colonne gauche : client + sélection des articles */}
          <section className="lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-outline-variant">
            <div className="p-4 md:p-6 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-on-surface">Client actif</h2>
                {clientActif && (
                  <button
                    type="button"
                    onClick={() => setClientId('')}
                    className="text-sm text-primary hover:bg-primary-container hover:text-on-primary-container px-3 py-1.5 rounded-full transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-1">edit</span>
                    Modifier
                  </button>
                )}
              </div>
              {clientActif ? (
                <div className="bg-secondary-container/30 border border-secondary/20 rounded-xl p-4 flex items-center">
                  <div className="h-12 w-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold mr-4 shadow-sm shrink-0">
                    {clientActif.nom.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-on-surface font-semibold">{clientActif.nom}</h3>
                    <p className="text-secondary text-sm flex items-center mt-1">
                      <span className="material-symbols-outlined text-[16px] mr-1">phone</span>
                      {clientActif.telephone}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Client"
                      className="flex-grow border border-outline-variant rounded-lg px-3 py-2"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                    >
                      <option value="" disabled>
                        Choisir un client…
                      </option>
                      {clients.data?.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.nom}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Nouveau client"
                      onClick={() => setNouveauClientOuvert((ouvert) => !ouvert)}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-primary hover:bg-primary-container hover:text-on-primary-container transition-colors"
                    >
                      <span className="material-symbols-outlined">person_add</span>
                    </button>
                  </div>

                  {nouveauClientOuvert && (
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-sm">
                        Nom
                        <input
                          className="border border-outline-variant rounded-lg px-3 py-2"
                          value={nouveauClientNom}
                          onChange={(event) => setNouveauClientNom(event.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Téléphone
                        <input
                          className="border border-outline-variant rounded-lg px-3 py-2"
                          value={nouveauClientTelephone}
                          onChange={(event) => setNouveauClientTelephone(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleCreerClient}
                        disabled={
                          creerClient.isPending || !nouveauClientNom || !nouveauClientTelephone
                        }
                        className="self-start bg-primary text-on-primary rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                      >
                        {creerClient.isPending ? 'Création…' : 'Créer le client'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-grow p-4 md:p-6 overflow-y-auto bg-surface-container-low">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-on-surface">
                  {categorieActive ? categorieActive : 'Sélection des articles'}
                </h2>
                {categorieActive && (
                  <button
                    type="button"
                    onClick={() => setCategorieActive(null)}
                    className="text-sm text-primary flex items-center"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
                    Catégories
                  </button>
                )}
              </div>

              {!categorieActive && (
                <div className="grid grid-cols-2 gap-4">
                  {categories.map(({ categorie, icone }) => (
                    <button
                      key={categorie}
                      type="button"
                      onClick={() => setCategorieActive(categorie)}
                      className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl text-center hover:border-primary hover:bg-surface transition-all flex flex-col items-center justify-center h-32 group shadow-sm"
                    >
                      <span
                        className="material-symbols-outlined text-4xl mb-2"
                        style={{ color: couleurIcone(icone) }}
                      >
                        {icone}
                      </span>
                      <span className="text-sm text-on-surface">{categorie}</span>
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="col-span-2 text-sm text-on-surface-variant">
                      Aucun service actif. Ajoutez-en depuis Tarifs &amp; services.
                    </p>
                  )}
                </div>
              )}

              {categorieActive && (
                <ul className="flex flex-col gap-2">
                  {servicesDeLaCategorie.map((service) => (
                    <li key={service.id}>
                      <button
                        type="button"
                        onClick={() => ajouterAuPanier(service.id)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 flex items-center justify-between hover:border-primary transition-colors"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="material-symbols-outlined"
                            style={{ color: couleurIcone(service.icone) }}
                          >
                            {service.icone ?? ICONE_PAR_DEFAUT}
                          </span>
                          <span className="text-on-surface font-medium">{service.intitule}</span>
                        </span>
                        <span className="font-mono text-sm text-secondary">
                          {service.tarif} FCFA
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Colonne droite : ticket / panier en cours */}
          <section className="lg:w-1/2 flex flex-col bg-surface-ticket">
            <div className="p-4 md:p-6 border-b border-outline-variant/50 flex justify-between items-center bg-surface-container-lowest">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Commande en cours</h2>
                <label className="flex items-center gap-2 mt-2 text-xs text-secondary">
                  Mode :
                  <select
                    aria-label="Mode"
                    className="border border-outline-variant rounded-lg px-2 py-1 text-xs"
                    value={modeLivraison}
                    onChange={(event) => setModeLivraison(event.target.value as ModeLivraison)}
                  >
                    <option value="RETRAIT">Retrait</option>
                    <option value="LIVRAISON">Livraison</option>
                  </select>
                </label>
              </div>
              {panier.length > 0 && (
                <button
                  type="button"
                  title="Vider le panier"
                  onClick={() => setPanier([])}
                  className="text-error hover:bg-error-container p-2 rounded-full transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
            </div>

            <div className="flex-grow p-4 md:p-6 overflow-y-auto">
              {panier.length === 0 && (
                <p className="text-sm text-on-surface-variant">
                  Aucun article. Sélectionnez une prestation à gauche.
                </p>
              )}
              <ul className="space-y-3">
                {panier.map((ligne) => {
                  const service = servicesParId.get(ligne.serviceId);
                  return (
                    <li
                      key={ligne.serviceId}
                      className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 flex justify-between items-start group shadow-sm"
                    >
                      <div className="flex-grow">
                        <h4 className="font-bold text-on-surface">
                          {service?.intitule ?? ligne.serviceId}
                        </h4>
                        <p className="text-xs text-secondary mt-1">{service?.categorie}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center border border-outline-variant rounded-full bg-surface">
                            <button
                              type="button"
                              aria-label={`Diminuer ${service?.intitule ?? ''}`}
                              onClick={() => modifierQuantite(ligne.serviceId, -1)}
                              className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">remove</span>
                            </button>
                            <span className="font-mono w-6 text-center">{ligne.quantite}</span>
                            <button
                              type="button"
                              aria-label={`Augmenter ${service?.intitule ?? ''}`}
                              onClick={() => modifierQuantite(ligne.serviceId, 1)}
                              className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                          </div>
                          <span className="font-mono text-secondary text-sm">
                            x {service?.tarif ?? '0'} FCFA
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-on-surface block">
                          {(Number(service?.tarif ?? 0) * ligne.quantite).toLocaleString('fr-FR')}{' '}
                          FCFA
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${service?.intitule ?? ''}`}
                          onClick={() => retirerDuPanier(ligne.serviceId)}
                          className="mt-4 text-outline hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-surface-container-lowest border-t border-outline p-4 md:p-6">
              {erreur && <p className="text-sm text-error mb-4">{erreur}</p>}
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-semibold text-secondary uppercase tracking-wide">
                  Total à encaisser
                </span>
                <span className="font-mono text-3xl text-on-surface">
                  {totalPanier.toLocaleString('fr-FR')}{' '}
                  <span className="text-lg text-secondary">FCFA</span>
                </span>
              </div>
              <button
                type="submit"
                disabled={creerCommande.isPending}
                className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
              >
                <span className="material-symbols-outlined">point_of_sale</span>
                {creerCommande.isPending ? 'Création…' : 'VALIDER LA COMMANDE'}
              </button>
            </div>
          </section>
        </form>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Rechercher (client, téléphone)
          <input
            type="search"
            placeholder="Nom ou téléphone…"
            value={rechercheCommande}
            onChange={(event) => setRechercheCommande(event.target.value)}
            className="border border-outline-variant rounded-lg px-3 py-2 min-w-[220px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mode
          <select
            value={filtreMode}
            onChange={(event) => setFiltreMode(event.target.value as ModeLivraison | '')}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            <option value="RETRAIT">Retrait</option>
            <option value="LIVRAISON">Livraison</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Statut
          <select
            value={filtreStatut}
            onChange={(event) => setFiltreStatut(event.target.value as StatutCommande | '')}
            className="border border-outline-variant rounded-lg px-3 py-2"
          >
            <option value="">Tous</option>
            {ORDRE_STATUT.map((statut) => (
              <option key={statut} value={statut}>
                {LIBELLES_STATUT_COMMANDE[statut]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-on-surface-variant">
              <th className="px-4 py-2">Numéro</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Téléphone</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {commandes.isPending && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={7}>
                  Chargement…
                </td>
              </tr>
            )}
            {!commandes.isPending && commandesFiltrees.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-on-surface-variant" colSpan={7}>
                  Aucune commande pour l'instant.
                </td>
              </tr>
            )}
            {commandesFiltrees.map((commande) => (
              <tr key={commande.id} className="border-t border-outline-variant">
                <td className="px-4 py-2 font-mono">#{commande.numero}</td>
                <td className="px-4 py-2">{clientsParId.get(commande.clientId)?.nom ?? '—'}</td>
                <td className="px-4 py-2">
                  {clientsParId.get(commande.clientId)?.telephone ?? '—'}
                </td>
                <td className="px-4 py-2">{commande.total} FCFA</td>
                <td className="px-4 py-2">{commande.modeLivraison}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge statut={commande.statut} />
                    {statutSuivant(commande.statut) && (
                      <button
                        type="button"
                        disabled={changerStatut.isPending}
                        onClick={() =>
                          changerStatut.mutate({
                            id: commande.id,
                            statut: statutSuivant(commande.statut) as StatutCommande,
                          })
                        }
                        title={`Passer à ${LIBELLES_STATUT_COMMANDE[statutSuivant(commande.statut) as StatutCommande]}`}
                        className="text-on-surface-variant hover:text-primary disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/commandes/${commande.id}/encaisser`}
                    className="text-primary text-xs font-medium"
                  >
                    Encaisser
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
