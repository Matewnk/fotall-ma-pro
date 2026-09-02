import { PrioriteTicketSupport } from '@prisma/client';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  sujet!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsIn(Object.values(PrioriteTicketSupport))
  priorite?: PrioriteTicketSupport;
}
