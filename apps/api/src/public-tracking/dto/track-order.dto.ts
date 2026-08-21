import { IsInt, IsString, Min, MinLength } from 'class-validator';

// Aucune authentification (portail client, public par nature) : le
// sous-domaine remplace le tenantId habituellement issu du JWT, et le
// téléphone joue le rôle de preuve de possession (comme une "question
// secrète") — sans lui, n'importe qui connaissant un simple numéro de
// commande pourrait suivre la commande de n'importe quel client.
export class TrackOrderDto {
  @IsString()
  @MinLength(1)
  sousDomaine!: string;

  @IsInt()
  @Min(1)
  numero!: number;

  @IsString()
  @MinLength(1)
  telephone!: string;
}
