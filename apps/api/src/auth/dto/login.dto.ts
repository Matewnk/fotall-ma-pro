import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  sousDomaine!: string;

  @IsEmail()
  email!: string;

  @IsString()
  motDePasse!: string;
}
