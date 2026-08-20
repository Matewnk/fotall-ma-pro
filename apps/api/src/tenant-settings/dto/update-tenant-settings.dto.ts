import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

// sousDomaine (routage de connexion) et plan (géré par la
// facturation/super-admin, 017) sont volontairement exclus : seuls les
// champs d'identité/branding sont éditables en self-service ADMIN.
export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nomPressing?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  langue?: string;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsString()
  fuseauHoraire?: string;
}
