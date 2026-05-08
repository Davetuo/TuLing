import { IsString, IsOptional, IsArray, IsEnum, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SpotSortType {
  COMPREHENSIVE = 'comprehensive',
  RATING = 'rating',
  POPULARITY = 'popularity',
}

export class SearchSpotsDto {
  @IsString()
  @IsNotEmpty({ message: '请输入搜索关键词' })
  keyword: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    return value;
  })
  tags?: string[];

  @IsOptional()
  @IsEnum(SpotSortType)
  sort?: SpotSortType = SpotSortType.COMPREHENSIVE;

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
