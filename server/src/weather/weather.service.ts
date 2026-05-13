import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface QWeatherCityLookup {
  code: string;
  location?: Array<{
    name: string;
    id: string;
    adm1?: string;
    adm2?: string;
  }>;
}

interface QWeatherDailyResponse {
  code: string;
  daily?: Array<{
    fxDate: string;
    textDay: string;
    textNight: string;
    tempMin: string;
    tempMax: string;
    windDirDay?: string;
    windScaleDay?: string;
    precip?: string;
    humidity?: string;
  }>;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly config: ConfigService) {}

  async getForecast(location: string, days = 3) {
    const credential = await this.getCredential();
    if (!credential) {
      throw new ServiceUnavailableException("未配置 QWEATHER_KEY");
    }

    const safeDays = Math.max(1, Math.min(Number.isFinite(days) ? days : 3, 7));
    const city = await this.lookupCity(location, credential);
    const host = this.config.get<string>(
      "QWEATHER_API_HOST",
      "https://devapi.qweather.com",
    );
    const url = new URL("/v7/weather/7d", host);
    url.searchParams.set("location", city.id);
    url.searchParams.set("lang", "zh");
    url.searchParams.set("unit", "m");

    const data = await this.fetchJson<QWeatherDailyResponse>(url, credential);
    if (data.code !== "200" || !data.daily) {
      this.logger.warn(`和风天气预报查询失败: ${data.code}`);
      throw new ServiceUnavailableException("天气服务暂不可用");
    }

    return {
      location: {
        id: city.id,
        name: city.name,
        adm1: city.adm1,
        adm2: city.adm2,
      },
      daily: data.daily.slice(0, safeDays).map((item) => ({
        date: item.fxDate,
        text:
          item.textDay === item.textNight
            ? item.textDay
            : `${item.textDay}转${item.textNight}`,
        temp: `${item.tempMin}-${item.tempMax}℃`,
        wind:
          item.windDirDay && item.windScaleDay
            ? `${item.windDirDay}${item.windScaleDay}级`
            : "",
        humidity: item.humidity ? `${item.humidity}%` : "",
        precip: item.precip ? `${item.precip}mm` : "",
        tip: this.buildTravelTip(
          item.textDay,
          Number(item.tempMax),
          Number(item.precip || 0),
        ),
      })),
    };
  }

  private async lookupCity(
    location: string,
    credential: { type: "key"; value: string },
  ) {
    const configuredGeoHost = this.config.get<string>("QWEATHER_GEO_HOST");
    const host = configuredGeoHost || "https://geoapi.qweather.com";
    const path = "/v2/city/lookup";
    const url = new URL(path, host);
    url.searchParams.set("location", location.trim() || "西安");
    url.searchParams.set("lang", "zh");

    const data = await this.fetchJson<QWeatherCityLookup>(url, credential);
    const city = data.location?.[0];
    if (data.code !== "200" || !city) {
      this.logger.warn(
        `和风天气城市查询失败: ${data.code}, location=${location}`,
      );
      throw new ServiceUnavailableException("未找到该目的地天气信息");
    }
    return city;
  }

  private async fetchJson<T>(
    url: URL,
    credential: { type: "key"; value: string },
  ): Promise<T> {
    url.searchParams.set("key", credential.value);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(
        `天气接口调用失败: ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException("天气服务暂不可用");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildTravelTip(text: string, tempMax: number, precip: number) {
    if (text.includes("雨") || precip > 0)
      return "建议携带雨具，优先保留室内景点作为备选。";
    if (tempMax >= 30) return "气温较高，建议错峰出行并安排室内休息点。";
    if (text.includes("雪")) return "注意防滑和保暖，预留交通缓冲时间。";
    return "适合户外步行游览，注意补水和防晒。";
  }

  private async getCredential() {
    const key = this.config.get<string>("QWEATHER_KEY");
    if (key) return { type: "key" as const, value: key };

    return null;
  }
}
