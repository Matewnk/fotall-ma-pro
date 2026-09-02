import { IsString, MinLength } from 'class-validator';

// Contrairement a ResetPasswordDto (ADMIN, confirmation geree uniquement
// cote client) : le SUPER_ADMIN agit sur un compte qui n'est pas le sien,
// dans un tenant qui n'est pas le sien — la confirmation est donc
// revalidee cote serveur, jamais seulement dans le formulaire.
export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  motDePasse!: string;

  @IsString()
  confirmerMotDePasse!: string;
}
