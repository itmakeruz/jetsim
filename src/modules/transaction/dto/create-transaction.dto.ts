import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ type: String, example: '1500', description: 'Amount in minor units (e.g. cents)' })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({ enum: TransactionStatus, required: false, default: TransactionStatus.PENDING })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({ type: String, required: false, example: '123456789012345678' })
  @IsOptional()
  @IsString()
  partner_transaction_id?: string;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @IsNumber()
  order_id?: number;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @ApiProperty({ required: false, description: 'Raw request payload sent to payment provider' })
  @IsOptional()
  request?: any;

  @ApiProperty({ required: false, description: 'Raw response payload from payment provider' })
  @IsOptional()
  response?: any;
}

