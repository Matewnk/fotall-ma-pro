import { IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteStep1Dto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nomPressing?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsString()
  langue?: string;
}
