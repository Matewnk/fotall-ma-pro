import { IsIn } from 'class-validator';

export class SetPermissionOverrideDto {
  @IsIn(['ALLOW', 'DENY'])
  effet!: 'ALLOW' | 'DENY';
}
