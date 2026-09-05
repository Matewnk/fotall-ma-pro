import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  // Optionnels au niveau DTO (decision explicite : champs mineurs,
  // non-bloquants — voir schema.prisma#User.prenom/nom) — la nouvelle page
  // d'inscription web les rend obligatoires cote client (UX), mais l'API
  // reste retro-compatible avec tout appelant existant qui ne les fournit
  // pas (register() ne les exige jamais).
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  prenom?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nom?: string;

  @IsString()
  @MinLength(2)
  nomPressing!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: 'sousDomaine doit être en minuscules alphanumériques avec tirets (3 à 63 caractères)',
  })
  sousDomaine!: string;

  @IsEmail()
  email!: string;

  // 10 caracteres minimum (formulaire d'inscription "Fotall-Ma Pro") — les
  // autres flux de mot de passe du projet (reset ADMIN/SUPER_ADMIN,
  // changement self-service) restent a 8, volontairement inchanges : ce
  // n'est qu'une exigence plus stricte specifique a la creation de compte,
  // jamais une regle globale reecrite ailleurs. Verifie ne rien casser
  // (aucun test existant n'enregistre avec un mot de passe de 8-9
  // caracteres).
  @IsString()
  @MinLength(10)
  motDePasse!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  pays?: string;
}
