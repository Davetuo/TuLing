import { IsInt, IsOptional, IsString, MaxLength, Min, Max } from "class-validator";

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;
}
