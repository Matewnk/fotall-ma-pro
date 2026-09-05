import { ActiviteBusiness, TypeDemandeBusiness } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBusinessContactRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nomComplet!: string;

  // Optionnel : obligatoire dans le formulaire Business (tenant connecté,
  // on connaît déjà le pressing), mais un visiteur public du formulaire de
  // contact du landing page peut ne pas encore en avoir un.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  entreprise?: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  // Volontairement peu restrictif (pas de regex de format) : ne doit pas
  // bloquer un numéro international ou un format WhatsApp local.
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  telephone!: string;

  @IsIn(Object.values(ActiviteBusiness))
  typeActivite!: ActiviteBusiness;

  @IsOptional()
  @IsInt()
  @Min(1)
  nombrePointsDeService?: number;

  @IsIn(Object.values(TypeDemandeBusiness))
  typeDemande!: TypeDemandeBusiness;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  // Informatif uniquement, jamais fait confiance pour une autorisation —
  // voir le commentaire sur BusinessContactRequest dans schema.prisma.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tenantId?: string;
}
