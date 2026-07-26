import { IsString, IsOptional, IsIn, IsNumber, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LineItemDto {
  @IsString() description!: string;
  @IsString() @IsOptional() unit?: string;
  @IsNumber() @IsOptional() qty?: number;
  @IsNumber() unitPrice!: number;
  @IsNumber() @IsOptional() gstPercent?: number;
  @IsString() @IsOptional() notes?: string;
  @IsNumber() @IsOptional() total?: number;
}

export class CreateInvoiceDto {
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() eventId?: string;
  @IsString() @IsOptional() propertyId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() invoiceNumber?: string;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() notes?: string;
  @IsNumber() @IsOptional() gstPercent?: number;
  @IsIn(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'PENDING']) @IsOptional() status?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) @IsOptional() lineItems?: LineItemDto[];
}

export class UpdateInvoiceDto {
  @IsIn(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'PENDING']) @IsOptional() status?: string;
  @IsDateString() @IsOptional() paidAt?: string;
  @IsDateString() @IsOptional() dueDate?: string;
}

class QuoteSectionDto {
  @IsString() title!: string;
  @IsNumber() @IsOptional() order?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) @IsOptional() lineItems?: LineItemDto[];
}

export class CreateQuotationDto {
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() eventId?: string;
  @IsString() @IsOptional() propertyId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsDateString() @IsOptional() validUntil?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() termsAndPaymentSchedule?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteSectionDto) @IsOptional() sections?: QuoteSectionDto[];
}

export class UpdateQuotationDto {
  @IsIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']) @IsOptional() status?: string;
}

export class CreateContractDto {
  @IsString() @IsOptional() quotationId?: string;
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() eventId?: string;
  @IsNumber() @IsOptional() amount?: number;
  @IsString() @IsOptional() notes?: string;
}

export class UpdateContractDto {
  @IsIn(['DRAFT', 'SENT', 'SIGNED', 'CANCELLED']) @IsOptional() status?: string;
  @IsDateString() @IsOptional() signedAt?: string;
  @IsDateString() @IsOptional() acceptedAt?: string;
}

export class CreateTransactionDto {
  @IsString() description!: string;
  @IsIn(['CUSTOMER', 'VENDOR', 'INTERNAL']) @IsOptional() partyType?: string;
  @IsIn(['INCOME', 'EXPENSE']) type!: string;
  @IsNumber() amount!: number;
  @IsString() @IsOptional() category?: string;
  @IsNumber() @IsOptional() gstPercent?: number;
  @IsDateString() @IsOptional() date?: string;
  @IsIn(['RECEIVED', 'PAID', 'PENDING', 'OVERDUE']) @IsOptional() status?: string;
  @IsString() @IsOptional() invoiceRef?: string;
  @IsString() @IsOptional() eventId?: string;
  @IsString() @IsOptional() receiptMediaId?: string;
}
