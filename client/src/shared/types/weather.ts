export interface WeatherForecast {
  location: {
    id: string;
    name: string;
    adm1?: string;
    adm2?: string;
  };
  daily: WeatherDaily[];
}

export interface WeatherDaily {
  date: string;
  text: string;
  temp: string;
  wind: string;
  humidity: string;
  precip: string;
  tip: string;
}
