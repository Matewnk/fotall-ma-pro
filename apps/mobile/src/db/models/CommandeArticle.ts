import { associations, Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { Commande } from './Commande';

export class CommandeArticle extends Model {
  static override table = 'commande_articles';
  static override associations = associations([
    'commandes',
    { type: 'belongs_to', key: 'commande_local_id' },
  ]);

  @field('commande_local_id') commandeLocalId!: string;
  @field('service_id') serviceId!: string;
  @field('quantite') quantite!: number;
  @field('tarif_unitaire') tarifUnitaire!: string;
  @field('sous_total') sousTotal!: string;

  @relation('commandes', 'commande_local_id') commande!: Commande;
}
