import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class NarrativeNodeDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(20)
  type!: string; // 'spot' | 'meal' | 'hotel'

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsString()
  start!: string;

  @IsString()
  end!: string;
}

class NarrativeDayDto {
  @IsInt()
  @Min(1)
  day!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NarrativeNodeDto)
  nodes!: NarrativeNodeDto[];
}

export class GenerateNarrativeDto {
  @IsString()
  @MaxLength(100)
  destination!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pace?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NarrativeDayDto)
  dailyPlans!: NarrativeDayDto[];
}
