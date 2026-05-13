import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { SearchHotelsDto, HotelSortType } from "./dto";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";

interface AmapPoi {
  id?: string;
  name?: string;
  type?: string;
  address?: unknown;
  location?: string;
  tel?: unknown;
  pname?: string;
  cityname?: string;
  adname?: string;
  biz_ext?: {
    rating?: unknown;
    cost?: unknown;
    open_time?: unknown;
  };
  photos?: Array<{ url?: string; title?: unknown }>;
}

interface AmapPlaceResp {
  status?: string;
  info?: string;
  infocode?: string;
  pois?: AmapPoi[];
}

@Injectable()
export class HotelService {
  private readonly logger = new Logger(HotelService.name);
  private readonly CACHE_TTL = 600;
  private readonly AMAP_DEDUP_TTL = 300;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private config: ConfigService,
  ) {}

  // ── 搜索 ──

  async searchHotels(dto: SearchHotelsDto, userId?: string) {
    let result = await this.queryLocal(dto, userId);

    const keyword = dto.keyword?.trim();
    if (result.items.length === 0 && (keyword || dto.city)) {
      const { processed } = await this.fallbackToAmap(
        keyword || "酒店",
        dto.city,
      );
      if (processed > 0) {
        await this.invalidateSearchCache(dto);
        result = await this.queryLocal(dto, userId);
      }
    }

    return result;
  }

  private async queryLocal(dto: SearchHotelsDto, userId?: string) {
    const {
      keyword,
      city,
      tags,
      starLevel,
      sort,
      page = 1,
      pageSize = 20,
    } = dto;

    const cacheKey = this.buildSearchCacheKey(dto);
    const cached = await this.getCache(cacheKey);
    if (cached && !userId) return cached;

    const where: Prisma.HotelWhereInput = {};

    if (keyword && keyword.trim()) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
      ];
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (tags && tags.length > 0) {
      where.tags = { hasEvery: tags };
    }

    if (starLevel) {
      where.starLevel = starLevel;
    }

    const orderBy = this.buildOrderBy(sort);

    const [total, items] = await Promise.all([
      this.prisma.hotel.count({ where }),
      this.prisma.hotel.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    let favoriteIds: Set<string> = new Set();
    if (userId) {
      const favorites = await this.prisma.hotelFavorite.findMany({
        where: {
          userId,
          hotelId: { in: items.map((it) => it.id) },
        },
        select: { hotelId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.hotelId));
    }

    const totalPages = Math.ceil(total / pageSize);
    const result = {
      items: items.map((item) => ({
        ...item,
        score: item.score ? Number(item.score) : null,
        lng: item.lng ? Number(item.lng) : null,
        lat: item.lat ? Number(item.lat) : null,
        thumbnail: item.images?.[0] || null,
        isFavorited: userId ? favoriteIds.has(item.id) : undefined,
      })),
      total,
      totalPages,
      currentPage: page,
    };

    if (!userId) {
      await this.setCache(cacheKey, result);
    }

    return result;
  }

  async getHotelDetail(hotelId: string, userId?: string) {
    const cacheKey = `hotel:detail:${hotelId}`;
    const cached = await this.getCache(cacheKey);

    let hotel: any;
    if (cached) {
      hotel = cached;
    } else {
      const raw = await this.prisma.hotel.findUnique({
        where: { id: hotelId },
      });

      if (!raw) {
        throw new NotFoundException("酒店不存在");
      }

      hotel = {
        ...raw,
        score: raw.score ? Number(raw.score) : null,
        lng: raw.lng ? Number(raw.lng) : null,
        lat: raw.lat ? Number(raw.lat) : null,
      };
      await this.setCache(cacheKey, hotel);
    }

    const reviewSummary = await this.getReviewSummary(hotelId);

    let isFavorited = false;
    if (userId) {
      const fav = await this.prisma.hotelFavorite.findUnique({
        where: { userId_hotelId: { userId, hotelId } },
      });
      isFavorited = !!fav;
    }

    return {
      ...hotel,
      reviewSummary,
      isFavorited: userId ? isFavorited : undefined,
    };
  }

  // ── 收藏 ──

  async favoriteHotel(userId: string, hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
    });
    if (!hotel) {
      throw new NotFoundException("酒店不存在");
    }

    await this.prisma.hotelFavorite.upsert({
      where: { userId_hotelId: { userId, hotelId } },
      create: { userId, hotelId },
      update: {},
    });

    return { success: true, message: "收藏成功" };
  }

  async unfavoriteHotel(userId: string, hotelId: string) {
    await this.prisma.hotelFavorite.deleteMany({
      where: { userId, hotelId },
    });
    return { success: true, message: "已取消收藏" };
  }

  async getFavorites(userId: string, page = 1, pageSize = 20) {
    const [total, favorites] = await Promise.all([
      this.prisma.hotelFavorite.count({ where: { userId } }),
      this.prisma.hotelFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { hotel: true },
      }),
    ]);

    return {
      items: favorites.map((f) => ({
        ...f.hotel,
        score: f.hotel.score ? Number(f.hotel.score) : null,
        lng: f.hotel.lng ? Number(f.hotel.lng) : null,
        lat: f.hotel.lat ? Number(f.hotel.lat) : null,
        thumbnail: f.hotel.images?.[0] || null,
        isFavorited: true,
        favoritedAt: f.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    };
  }

  // ── 评价 ──

  async getReviews(hotelId: string, page = 1, pageSize = 10) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
    });
    if (!hotel) {
      throw new NotFoundException("酒店不存在");
    }

    const [total, reviews] = await Promise.all([
      this.prisma.hotelReview.count({
        where: { hotelId, status: "approved" },
      }),
      this.prisma.hotelReview.findMany({
        where: { hotelId, status: "approved" },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return {
      items: reviews.map((r) => ({
        id: r.id,
        score: r.score,
        content: r.content,
        images: r.images,
        createdAt: r.createdAt,
        user: r.user,
      })),
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    };
  }

  async getReviewSummary(hotelId: string) {
    const [totalReviews, avgResult] = await Promise.all([
      this.prisma.hotelReview.count({
        where: { hotelId, status: "approved" },
      }),
      this.prisma.hotelReview.aggregate({
        where: { hotelId, status: "approved" },
        _avg: { score: true },
      }),
    ]);

    const topReviews = await this.prisma.hotelReview.findMany({
      where: { hotelId, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { nickname: true, avatarUrl: true } },
      },
    });

    return {
      totalReviews,
      averageScore: avgResult._avg.score
        ? Number(avgResult._avg.score.toFixed(1))
        : null,
      topReviews: topReviews.map((r) => ({
        id: r.id,
        score: r.score,
        content: r.content
          ? r.content.substring(0, 100) + (r.content.length > 100 ? "..." : "")
          : null,
        images: r.images?.slice(0, 3) || [],
        createdAt: r.createdAt,
        user: r.user,
      })),
    };
  }

  async createReview(
    hotelId: string,
    userId: string,
    score: number,
    content?: string,
  ) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true },
    });
    if (!hotel) {
      throw new NotFoundException("酒店不存在");
    }

    const review = await this.prisma.hotelReview.create({
      data: {
        hotelId,
        userId,
        score,
        content: content?.trim() || null,
        images: [],
        status: "approved",
      },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });

    try {
      const client = this.redisService.getClient();
      if (client) await client.del(`hotel:detail:${hotelId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${hotelId}`, error);
    }

    return {
      id: review.id,
      score: review.score,
      content: review.content,
      images: review.images,
      createdAt: review.createdAt,
      user: review.user,
    };
  }

  async getMyReviews(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const [total, reviews] = await Promise.all([
      this.prisma.hotelReview.count({ where: { userId } }),
      this.prisma.hotelReview.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          hotel: {
            select: { id: true, name: true, city: true, images: true },
          },
        },
      }),
    ]);

    return {
      items: reviews.map((r) => ({
        id: r.id,
        score: r.score,
        content: r.content,
        images: r.images,
        status: r.status,
        createdAt: r.createdAt,
        hotel: {
          id: r.hotel.id,
          name: r.hotel.name,
          city: r.hotel.city,
          thumbnail: r.hotel.images?.[0] || null,
        },
      })),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  async deleteMyReview(userId: string, reviewId: string) {
    const review = await this.prisma.hotelReview.findUnique({
      where: { id: reviewId },
      select: { userId: true, hotelId: true },
    });
    if (!review) {
      throw new NotFoundException("评价不存在");
    }
    if (review.userId !== userId) {
      throw new NotFoundException("评价不存在");
    }
    await this.prisma.hotelReview.delete({ where: { id: reviewId } });
    try {
      const client = this.redisService.getClient();
      if (client) await client.del(`hotel:detail:${review.hotelId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${review.hotelId}`, error);
    }
    return { success: true };
  }

  // ── 内部方法 ──

  private buildOrderBy(
    sort?: HotelSortType,
  ): Prisma.HotelOrderByWithRelationInput[] {
    switch (sort) {
      case HotelSortType.RATING:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
      case HotelSortType.POPULARITY:
        return [{ score: { sort: "desc", nulls: "last" } }, { name: "asc" }];
      case HotelSortType.COMPREHENSIVE:
      default:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
    }
  }

  private buildSearchCacheKey(dto: SearchHotelsDto): string {
    const hash = crypto
      .createHash("md5")
      .update(
        JSON.stringify({
          k: dto.keyword,
          c: dto.city,
          t: dto.tags,
          sl: dto.starLevel,
          s: dto.sort,
          p: dto.page,
          ps: dto.pageSize,
        }),
      )
      .digest("hex");
    return `hotel:search:${hash}`;
  }

  private async getCache(key: string): Promise<any | null> {
    try {
      const client = this.redisService.getClient();
      if (!client) return null;
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private async setCache(
    key: string,
    data: any,
    ttl: number = this.CACHE_TTL,
  ): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      await client.set(key, JSON.stringify(data), "EX", ttl);
    } catch (error) {
      this.logger.warn(`缓存写入失败: ${key}`, error);
    }
  }

  private async invalidateSearchCache(dto: SearchHotelsDto): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      await client.del(this.buildSearchCacheKey(dto));
    } catch (error) {
      this.logger.warn(`搜索缓存失效失败`, error);
    }
  }

  // ─── 高德兜底 ───────────────────────────────────────────

  private async fallbackToAmap(
    keyword: string,
    city?: string,
  ): Promise<{ processed: number; inserted: number }> {
    const key = this.config.get<string>("AMAP_WEB_KEY");
    if (!key) {
      this.logger.warn("AMAP_WEB_KEY 未配置，跳过高德兜底");
      return { processed: 0, inserted: 0 };
    }

    const dedupKey = `hotel:amap-live:${keyword}:${city || "all"}`;
    if (await this.getCache(dedupKey)) {
      return { processed: 0, inserted: 0 };
    }

    this.logger.log(
      `高德兜底(酒店): keyword="${keyword}"${city ? ` city="${city}"` : ""}`,
    );

    const pois = await this.fetchAmapPois(keyword, city);
    await this.setCache(dedupKey, true, this.AMAP_DEDUP_TTL);

    if (pois.length === 0) return { processed: 0, inserted: 0 };

    let inserted = 0;
    for (const poi of pois) {
      if (await this.upsertAmapPoi(poi, city)) inserted++;
    }
    this.logger.log(`高德兜底入库(酒店): 新增 ${inserted} / 处理 ${pois.length}`);
    return { processed: pois.length, inserted };
  }

  private async fetchAmapPois(
    keyword: string,
    city?: string,
  ): Promise<AmapPoi[]> {
    const key = this.config.get<string>("AMAP_WEB_KEY")!;
    const url = new URL("https://restapi.amap.com/v3/place/text");
    url.searchParams.set("key", key);
    url.searchParams.set("keywords", keyword);
    // 住宿服务大类
    url.searchParams.set("types", "100000");
    if (city) {
      url.searchParams.set("city", city);
      url.searchParams.set("citylimit", "true");
    }
    url.searchParams.set("extensions", "all");
    url.searchParams.set("offset", "25");
    url.searchParams.set("page", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`高德 HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as AmapPlaceResp;
      if (data.status !== "1") {
        this.logger.warn(`高德返回错误: ${data.info} (${data.infocode})`);
        return [];
      }
      return (data.pois || []).filter((p) => this.isValidAmapPoi(p));
    } catch (err) {
      this.logger.warn(
        `高德请求失败: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async upsertAmapPoi(
    poi: AmapPoi,
    fallbackCity?: string,
  ): Promise<boolean> {
    const name = this.pickText(poi.name);
    const address = this.pickText(poi.address);
    if (!name || !address) return false;

    const city =
      this.pickText(poi.cityname) ||
      this.pickText(poi.pname) ||
      fallbackCity ||
      "";

    const adname = this.pickText(poi.adname) || "";
    const fullAddress =
      adname && !address.startsWith(adname) ? `${adname}${address}` : address;

    const { lng, lat } = this.pickLocation(poi);
    const starLevel = this.pickStarLevel(poi);
    const { priceMin, priceMax } = this.pickPriceBand(starLevel);

    const data = {
      name,
      city,
      address: fullAddress,
      tags: this.pickAmapTags(poi),
      score: this.pickAmapScore(poi),
      starLevel,
      priceMin,
      priceMax,
      openTime: this.pickText(poi.biz_ext?.open_time) || null,
      images: this.pickAmapImages(poi),
      introduction: null,
      phone: this.pickText(poi.tel) || null,
      lng,
      lat,
      source: "amap-live",
    };

    const existing = await this.prisma.hotel.findFirst({
      where: { name, city },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.hotel.update({
        where: { id: existing.id },
        data,
      });
      return false;
    } else {
      await this.prisma.hotel.create({ data });
      return true;
    }
  }

  private isValidAmapPoi(poi: AmapPoi): boolean {
    const name = this.pickText(poi.name);
    const address = this.pickText(poi.address);
    if (!name || !address) return false;

    const location = this.pickText(poi.location);
    if (!location || !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) return false;

    // 酒店黑名单：排除景点/餐厅/办公等混入项
    const nameBlacklist = [
      "景区",
      "公园",
      "博物馆",
      "纪念馆",
      "餐厅",
      "饭店",
      "茶馆",
      "咖啡",
      "酒吧",
      "停车场",
      "加油站",
      "超市",
      "便利店",
      "学校",
      "幼儿园",
      "派出所",
      "营业厅",
      "支行",
      "银行",
      "写字楼",
      "办公楼",
      "产业园",
      "工业园",
    ];
    if (nameBlacklist.some((b) => name.includes(b))) return false;

    return true;
  }

  // ─── 字段清洗 helper ───────────────────────────────────

  private pickText(v: unknown): string | undefined {
    if (v == null || Array.isArray(v)) return undefined;
    const s = String(v).trim();
    return s ? s : undefined;
  }

  private pickLocation(poi: AmapPoi): {
    lng: number | null;
    lat: number | null;
  } {
    const loc = this.pickText(poi.location);
    if (!loc) return { lng: null, lat: null };
    const [lngStr, latStr] = loc.split(",");
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat))
      return { lng: null, lat: null };
    return { lng, lat };
  }

  private pickAmapTags(poi: AmapPoi): string[] {
    const tags = new Set<string>(["住宿"]);
    const type = this.pickText(poi.type) || "";
    if (type.includes("五星")) tags.add("五星级");
    if (type.includes("四星")) tags.add("四星级");
    if (type.includes("三星")) tags.add("三星级");
    if (type.includes("经济")) tags.add("经济型");
    if (type.includes("快捷")) tags.add("快捷");
    if (type.includes("商务")) tags.add("商务");
    if (type.includes("公寓")) tags.add("公寓");
    if (type.includes("民宿") || type.includes("客栈")) tags.add("民宿");
    return Array.from(tags);
  }

  // 从 AMap type 或 name 解析星级（1-5），无法识别返回 null
  private pickStarLevel(poi: AmapPoi): number | null {
    const text =
      (this.pickText(poi.type) || "") + (this.pickText(poi.name) || "");
    if (text.includes("五星")) return 5;
    if (text.includes("四星")) return 4;
    if (text.includes("三星")) return 3;
    if (text.includes("二星")) return 2;
    if (text.includes("一星")) return 1;
    // 经济型/快捷酒店默认 2 星价位带
    if (text.includes("经济") || text.includes("快捷")) return 2;
    // 商务/精品酒店默认 4 星价位带
    if (text.includes("商务") || text.includes("精品")) return 4;
    return null;
  }

  // 价位带（元/晚）：行程预算估算用，非真实房价
  private pickPriceBand(starLevel: number | null): {
    priceMin: number | null;
    priceMax: number | null;
  } {
    switch (starLevel) {
      case 5:
        return { priceMin: 1200, priceMax: 2500 };
      case 4:
        return { priceMin: 600, priceMax: 1100 };
      case 3:
        return { priceMin: 350, priceMax: 600 };
      case 2:
        return { priceMin: 200, priceMax: 350 };
      case 1:
        return { priceMin: 120, priceMax: 200 };
      default:
        return { priceMin: null, priceMax: null };
    }
  }

  private pickAmapImages(poi: AmapPoi): string[] {
    return (poi.photos || [])
      .map((p) => p.url)
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      .slice(0, 5);
  }

  private pickAmapScore(poi: AmapPoi): number | null {
    const raw = this.pickText(poi.biz_ext?.rating);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(5, Math.max(0, Number(n.toFixed(1))));
  }
}
