import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

// WatermelonDB normalise toute colonne optionnelle absente à `null`
// (jamais `undefined`) au niveau des décorateurs @field/@date — d'où les
// types `| null` ci-dessous plutôt que des propriétés `?:` classiques.
export class Client extends Model {
  static override table = 'clients';

  @field('server_id') serverId!: string;
  @field('nom') nom!: string;
  @field('telephone') telephone!: string;
  @field('email') email!: string | null;
  @field('adresse') adresse!: string | null;
  @field('notes') notes!: string | null;

  @date('nom_updated_at') nomUpdatedAt!: Date;
  @date('telephone_updated_at') telephoneUpdatedAt!: Date;
  @date('email_updated_at') emailUpdatedAt!: Date | null;
  @date('adresse_updated_at') adresseUpdatedAt!: Date | null;
  @date('notes_updated_at') notesUpdatedAt!: Date | null;

  @date('synced_at') syncedAt!: Date | null;

  get aDesModificationsNonSynchronisees(): boolean {
    if (!this.syncedAt) {
      return true;
    }
    const horodatagesChamps = [
      this.nomUpdatedAt,
      this.telephoneUpdatedAt,
      this.emailUpdatedAt,
      this.adresseUpdatedAt,
      this.notesUpdatedAt,
    ].filter((horodatage): horodatage is Date => horodatage !== null);
    return horodatagesChamps.some((horodatage) => horodatage > this.syncedAt!);
  }
}
