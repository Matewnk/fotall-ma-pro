import { IsString, MinLength } from 'class-validator';

export class SuspendLicenceDto {
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  // Le motif est obligatoire : une suspension est une action manuelle
  // sensible (Constitution VII, cahier des charges §13.6/§19.4).
  @IsString()
  @MinLength(3)
  motif!: string;
}
