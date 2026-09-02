import { IsString, MinLength } from 'class-validator';

export class CreateSupportTicketMessageDto {
  @IsString()
  @MinLength(1)
  corps!: string;
}
