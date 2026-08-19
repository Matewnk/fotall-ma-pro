import { IsString, MinLength } from 'class-validator';

export class StartSupportSessionDto {
  // Motif obligatoire : aucun accès détaillé à un tenant sans justification
  // explicite (cahier des charges §16).
  @IsString()
  @MinLength(3)
  motif!: string;
}
