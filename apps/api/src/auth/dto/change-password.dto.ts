import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  motDePasseActuel!: string;

  @IsString()
  @MinLength(8)
  motDePasseNouveau!: string;
}
