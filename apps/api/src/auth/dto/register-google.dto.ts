import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Finalise une inscription initiee via Google (voir
// AuthService#finaliserInscriptionGoogle) : email/prenom/nom viennent du
// ticket signe cote serveur (verifie par Google), jamais du client — seuls
// nomPressing/sousDomaine/pays sont fournis ici, Google ne les connait pas.
export class RegisterGoogleDto {
  @IsString()
  ticket!: string;

  @IsString()
  @MinLength(2)
  nomPressing!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: 'sousDomaine doit être en minuscules alphanumériques avec tirets (3 à 63 caractères)',
  })
  sousDomaine!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  pays?: string;
}
