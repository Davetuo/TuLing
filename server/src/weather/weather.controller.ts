import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { WeatherService } from './weather.service';

@Controller('api/weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Public()
  @Get('forecast')
  async getForecast(
    @Query('location') location = '西安',
    @Query('days') days = '3',
  ) {
    return this.weatherService.getForecast(location, Number.parseInt(days, 10));
  }
}
