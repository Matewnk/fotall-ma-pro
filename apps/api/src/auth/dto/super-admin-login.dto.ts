import { IsEmail, IsString } from 'class-validator';

// Pas de sousDomaine : un SUPER_ADMIN n'appartient à aucun tenant
// (tenantId null), donc le flux LoginDto (qui résout le tenant par
// sousDomaine avant de chercher l'utilisateur) ne peut pas s'appliquer.
export class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  motDePasse!: string;
}
