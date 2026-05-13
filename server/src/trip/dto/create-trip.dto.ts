import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RoutePointDto {
  @IsString()
  id!: string;

  @IsInt()
  day!: number;

  @IsInt()
  order!: number;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(100)
  area!: string;

  @IsString()
  @MaxLength(500)
  address!: string;

  @IsString()
  start!: string;

  @IsString()
  end!: string;

  @IsString()
  duration!: string;

  @IsString()
  @MaxLength(200)
  transport!: string;

  @IsString()
  @MaxLength(500)
  note!: string;

  @IsNumber()
  lng!: number;

  @IsNumber()
  lat!: number;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @IsOptional()
  @IsString()
  refId?: string;
}

class DailyPlanDto {
  @IsInt()
  day!: number;

  @IsString()
  date!: string;

  @IsString()
  @MaxLength(200)
  theme!: string;

  @IsString()
  @MaxLength(500)
  summary!: string;

  @IsString()
  distance!: string;

  @IsString()
  transitTime!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  nodes!: RoutePointDto[];
}

class BudgetDetailDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @IsString()
  @MaxLength(200)
  meta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  unitText?: string;

  @IsInt()
  @Min(0)
  totalCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  refNodeId?: string;
}

class BudgetItemDto {
  @IsString()
  @MaxLength(50)
  label!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(200)
  note!: string;

  @IsOptional()
  @IsBoolean()
  expandable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  category?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetDetailDto)
  details?: BudgetDetailDto[];
}

class WeatherDailyDto {
  @IsString()
  date!: string;

  @IsString()
  text!: string;

  @IsString()
  temp!: string;

  @IsString()
  wind!: string;

  @IsString()
  humidity!: string;

  @IsString()
  precip!: string;

  @IsString()
  tip!: string;
}

export class CreateTripDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(100)
  destination!: string;

  @IsString()
  @MaxLength(20)
  startDate!: string;

  @IsString()
  @MaxLength(20)
  endDate!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  people!: number;

  @IsInt()
  @Min(0)
  budget!: number;

  @IsString()
  @MaxLength(20)
  pace!: string;

  @IsArray()
  @IsString({ each: true })
  preferences!: string[];

  @IsString()
  summary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyPlanDto)
  dailyPlans!: DailyPlanDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  budgetItems!: BudgetItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeatherDailyDto)
  weather?: WeatherDailyDto[];
}
