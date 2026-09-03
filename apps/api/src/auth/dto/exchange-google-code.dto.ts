import { IsString } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  code!: string;
}
