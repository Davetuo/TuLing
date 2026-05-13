import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export enum RestaurantSortType {
  COMPREHENSIVE = "comprehensive",
  RATING = "rating",
  POPULARITY = "popularity",
}

export class SearchRestaurantsDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") return [value];
    return value;
  })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") return [value];
    return value;
  })
  cuisine?: string[];

  @IsOptional()
  @IsEnum(RestaurantSortType)
  sort?: RestaurantSortType = RestaurantSortType.COMPREHENSIVE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
