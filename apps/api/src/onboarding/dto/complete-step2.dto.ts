import { IsIn } from 'class-validator';
import { ChoixCatalogue } from '@prisma/client';

export class CompleteStep2Dto {
  @IsIn(Object.values(ChoixCatalogue))
  choix!: ChoixCatalogue;
}
