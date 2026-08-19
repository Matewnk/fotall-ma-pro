import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  action!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
