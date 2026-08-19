import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
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

  @IsString()
  @MinLength(8)
  motDePasse!: string;
}
