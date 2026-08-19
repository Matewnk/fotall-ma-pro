import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ModeLivraison } from '../../generated/tenant-client';

export class CreateOrderArticleDto {
  @IsString()
  serviceId!: string;

  @IsInt()
  @Min(1)
  quantite!: number;
}

export class CreateOrderDto {
  @IsString()
  clientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderArticleDto)
  articles!: CreateOrderArticleDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  remise?: number;

  @IsOptional()
  @IsString()
  datePrevue?: string;

  @IsIn(Object.values(ModeLivraison))
  modeLivraison!: ModeLivraison;

  @IsOptional()
  @IsString()
  adresseLivraison?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}
