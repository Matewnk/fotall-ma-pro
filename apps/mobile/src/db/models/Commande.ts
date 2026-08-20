import { associations, Model, Query } from '@nozbe/watermelondb';
import { children, date, field } from '@nozbe/watermelondb/decorators';
import type { CommandeArticle } from './CommandeArticle';

// WatermelonDB normalise toute colonne optionnelle absente à `null`
// (jamais `undefined`) au niveau des décorateurs @field/@date — d'où les
// types `| null` ci-dessous plutôt que des propriétés `?:` classiques.
export class Commande extends Model {
  static override table = 'commandes';
  static override associations = associations([
    'commande_articles',
    { type: 'has_many', foreignKey: 'commande_local_id' },
  ]);

  @field('server_id') serverId!: string | null;
  @field('numero') numero!: number | null;
  @field('client_server_id') clientServerId!: string;
  @field('statut') statut!: string;
  @field('sous_total') sousTotal!: string;
  @field('remise') remise!: string;
  @field('total') total!: string;
  @field('mode_livraison') modeLivraison!: string;
  @field('adresse_livraison') adresseLivraison!: string | null;
  @date('date_prevue') datePrevue!: Date | null;
  @field('notes') notes!: string | null;
  @field('device_id') deviceId!: string;
  @field('idempotency_key') idempotencyKey!: string;
  @date('local_created_at') localCreatedAt!: Date;
  @date('synced_at') syncedAt!: Date | null;
  @field('derniere_statut_poussee') derniereStatutPoussee!: string | null;

  @children('commande_articles') articles!: Query<CommandeArticle>;

  get estEnAttenteDeCreation(): boolean {
    return this.syncedAt === null;
  }

  get estEnAttenteDePoussageStatut(): boolean {
    return this.syncedAt !== null && this.statut !== this.derniereStatutPoussee;
  }
}
