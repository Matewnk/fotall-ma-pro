import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

// Journal append-only, comme côté API (010-cash) : ce modèle n'expose
// volontairement aucune méthode update/delete — une correction est une
// nouvelle ligne (AJUSTEMENT_COMPENSATOIRE), jamais une modification.
//
// WatermelonDB normalise toute colonne optionnelle absente à `null`
// (jamais `undefined`) au niveau des décorateurs @field/@date — d'où les
// types `| null` ci-dessous plutôt que des propriétés `?:` classiques.
export class OperationCaisse extends Model {
  static override table = 'operations_caisse';

  @field('server_id') serverId!: string | null;
  @field('type') type!: string;
  @field('montant') montant!: string;
  @field('mode_paiement') modePaiement!: string | null;
  @field('reference') reference!: string | null;
  @field('commande_server_id') commandeServerId!: string | null;
  @field('device_id') deviceId!: string;
  @field('idempotency_key') idempotencyKey!: string;
  @date('local_created_at') localCreatedAt!: Date;
  @date('synced_at') syncedAt!: Date | null;

  get estEnAttenteDeSynchronisation(): boolean {
    return this.syncedAt === null;
  }
}
