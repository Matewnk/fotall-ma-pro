import { CanalNotification, StatutClient } from '../../generated/tenant-client';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nom?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsIn(Object.values(CanalNotification))
  canalNotification?: CanalNotification;

  @IsOptional()
  @IsIn(Object.values(StatutClient))
  statut?: StatutClient;

  @IsOptional()
  @IsString()
  notes?: string;
}
