import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { SCOPES_DISPONIBLES } from '../api-key.constants';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SCOPES_DISPONIBLES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  quotaJour?: number;
}
