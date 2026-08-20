import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ROLES_GERABLES_PAR_ADMIN } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES_GERABLES_PAR_ADMIN)
  role?: (typeof ROLES_GERABLES_PAR_ADMIN)[number];

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
