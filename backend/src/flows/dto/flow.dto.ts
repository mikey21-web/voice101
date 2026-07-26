import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateFlowDto {
  @IsString() name: string;
  @IsArray() @IsOptional() nodes?: any[];
  @IsArray() @IsOptional() edges?: any[];
  @IsArray() @IsOptional() triggerKeywords?: string[];
  @IsBoolean() @IsOptional() isDefault?: boolean;
}

export class UpdateFlowDto {
  @IsString() @IsOptional() name?: string;
  @IsArray() @IsOptional() nodes?: any[];
  @IsArray() @IsOptional() edges?: any[];
  @IsArray() @IsOptional() triggerKeywords?: string[];
  @IsBoolean() @IsOptional() active?: boolean;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}
