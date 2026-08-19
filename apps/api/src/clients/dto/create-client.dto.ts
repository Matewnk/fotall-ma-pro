import { CanalNotification } from '../../generated/tenant-client';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  // Obligatoire (cahier des charges §5.1).
  @IsString()
  @MinLength(6)
  telephone!: string;

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
  @IsString()
  notes?: string;
}
