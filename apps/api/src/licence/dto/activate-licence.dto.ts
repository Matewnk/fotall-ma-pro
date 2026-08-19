import { IsOptional, IsString, MinLength } from 'class-validator';

export class ActivateLicenceDto {
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  motif?: string;
}
