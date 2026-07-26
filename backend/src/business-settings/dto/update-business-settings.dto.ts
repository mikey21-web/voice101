import { IsString, IsEmail, IsOptional, IsObject } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsString() @IsOptional() businessName?: string;
  @IsString() @IsOptional() timezone?: string;
  @IsString() @IsOptional() defaultCurrency?: string;
  @IsString() @IsOptional() defaultWhatsAppNumber?: string;
  @IsEmail() @IsOptional() defaultEmail?: string;
  @IsString() @IsOptional() defaultCrm?: string;
  @IsString() @IsOptional() defaultBookingTool?: string;
  @IsString() @IsOptional() workingHoursStart?: string;
  @IsString() @IsOptional() workingHoursEnd?: string;
  @IsEmail() @IsOptional() notificationEmail?: string;
  @IsString() @IsOptional() notificationPhone?: string;
  @IsString() @IsOptional() logoUrl?: string;
  @IsString() @IsOptional() faviconUrl?: string;
  @IsString() @IsOptional() primaryColor?: string;
  @IsObject() @IsOptional() labels?: Record<string, string>;
  @IsString() @IsOptional() industry?: string;
  @IsString() @IsOptional() agentMode?: string; // AI | FLOW
}
