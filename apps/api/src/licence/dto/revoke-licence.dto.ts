import { IsString, MinLength } from 'class-validator';

export class RevokeLicenceDto {
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  // Motif obligatoire : révocation définitive, action manuelle irréversible.
  @IsString()
  @MinLength(3)
  motif!: string;
}
