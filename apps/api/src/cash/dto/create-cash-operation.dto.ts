import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ModePaiement, TypeOperationCaisse } from '../../generated/tenant-client';

export class CreateCashOperationDto {
  @IsIn(Object.values(TypeOperationCaisse))
  type!: TypeOperationCaisse;

  @IsNumber()
  montant!: number;

  @IsOptional()
  @IsIn(Object.values(ModePaiement))
  modePaiement?: ModePaiement;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  commandeId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}
