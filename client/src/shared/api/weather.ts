import { apiClient } from './client'
import type { WeatherForecast } from '../types/weather'

export function getWeatherForecast(location: string, days: number) {
  return apiClient.get<WeatherForecast>('/weather/forecast', {
    params: { location, days },
  })
}
