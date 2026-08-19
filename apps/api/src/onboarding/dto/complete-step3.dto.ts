import { IsIn } from 'class-validator';
import { CanalNotification } from '@prisma/client';

export class CompleteStep3Dto {
  @IsIn(Object.values(CanalNotification))
  canalPreference!: CanalNotification;
}
