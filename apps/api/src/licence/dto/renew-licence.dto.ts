import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RenewLicenceDto {
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsInt()
  @Min(1)
  dureeJours!: number;

  @IsOptional()
  @IsString()
  motif?: string;
}
