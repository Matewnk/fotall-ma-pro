import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

// SUPER_ADMIN volontairement exclu : un ADMIN ne peut jamais créer un
// compte plateforme, seulement des rôles de son propre tenant (§2.1).
export const ROLES_GERABLES_PAR_ADMIN = [
  Role.ADMIN,
  Role.CAISSIER,
  Role.TECHNICIEN,
  Role.LIVREUR,
] as const;

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  motDePasse!: string;

  @IsIn(ROLES_GERABLES_PAR_ADMIN)
  role!: Role;
}
