import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { SearchRestaurantsDto, RestaurantSortType } from "./dto";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";

// ─── 高德 POI 响应类型 ──────────────────────────────────────────
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
export class RestaurantService {
  private readonly logger = new Logger(RestaurantService.name);
  private readonly CACHE_TTL = 600;
  private readonly AMAP_DEDUP_TTL = 300;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private config: ConfigService,
  ) {}

  // ── 搜索 ──

  async searchRestaurants(dto: SearchRestaurantsDto, userId?: string) {
    let result = await this.queryLocal(dto, userId);

    const keyword = dto.keyword?.trim();
    if (result.items.length === 0 && (keyword || dto.city)) {
      const { processed } = await this.fallbackToAmap(
        keyword || "餐厅",
        dto.city,
      );
      if (processed > 0) {
        await this.invalidateSearchCache(dto);
        result = await this.queryLocal(dto, userId);
      }
    }

    return result;
  }

  private async queryLocal(dto: SearchRestaurantsDto, userId?: string) {
    const {
      keyword,
      city,
      tags,
      cuisine,
      sort,
      page = 1,
      pageSize = 20,
    } = dto;

    const cacheKey = this.buildSearchCacheKey(dto);
    const cached = await this.getCache(cacheKey);
    if (cached && !userId) return cached;

    const where: Prisma.RestaurantWhereInput = {};

    if (keyword && keyword.trim()) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
        { cuisine: { has: keyword } },
      ];
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (tags && tags.length > 0) {
      where.tags = { hasEvery: tags };
    }

    if (cuisine && cuisine.length > 0) {
      where.cuisine = { hasSome: cuisine };
    }

    const orderBy = this.buildOrderBy(sort);

    const [total, items] = await Promise.all([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    let favoriteIds: Set<string> = new Set();
    if (userId) {
      const favorites = await this.prisma.restaurantFavorite.findMany({
        where: {
          userId,
          restaurantId: { in: items.map((it) => it.id) },
        },
        select: { restaurantId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.restaurantId));
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

  async getRestaurantDetail(restaurantId: string, userId?: string) {
    const cacheKey = `restaurant:detail:${restaurantId}`;
    const cached = await this.getCache(cacheKey);

    let restaurant: any;
    if (cached) {
      restaurant = cached;
    } else {
      const raw = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });

      if (!raw) {
        throw new NotFoundException("餐厅不存在");
      }

      restaurant = {
        ...raw,
        score: raw.score ? Number(raw.score) : null,
        lng: raw.lng ? Number(raw.lng) : null,
        lat: raw.lat ? Number(raw.lat) : null,
      };
      await this.setCache(cacheKey, restaurant);
    }

    const reviewSummary = await this.getReviewSummary(restaurantId);

    let isFavorited = false;
    if (userId) {
      const fav = await this.prisma.restaurantFavorite.findUnique({
        where: { userId_restaurantId: { userId, restaurantId } },
      });
      isFavorited = !!fav;
    }

    return {
      ...restaurant,
      reviewSummary,
      isFavorited: userId ? isFavorited : undefined,
    };
  }

  // ── 收藏 ──

  async favoriteRestaurant(userId: string, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException("餐厅不存在");
    }

    await this.prisma.restaurantFavorite.upsert({
      where: { userId_restaurantId: { userId, restaurantId } },
      create: { userId, restaurantId },
      update: {},
    });

    return { success: true, message: "收藏成功" };
  }

  async unfavoriteRestaurant(userId: string, restaurantId: string) {
    await this.prisma.restaurantFavorite.deleteMany({
      where: { userId, restaurantId },
    });
    return { success: true, message: "已取消收藏" };
  }

  async getFavorites(userId: string, page = 1, pageSize = 20) {
    const [total, favorites] = await Promise.all([
      this.prisma.restaurantFavorite.count({ where: { userId } }),
      this.prisma.restaurantFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          restaurant: true,
        },
      }),
    ]);

    return {
      items: favorites.map((f) => ({
        ...f.restaurant,
        score: f.restaurant.score ? Number(f.restaurant.score) : null,
        lng: f.restaurant.lng ? Number(f.restaurant.lng) : null,
        lat: f.restaurant.lat ? Number(f.restaurant.lat) : null,
        thumbnail: f.restaurant.images?.[0] || null,
        isFavorited: true,
        favoritedAt: f.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    };
  }

  // ── 评价 ──

  async getReviews(restaurantId: string, page = 1, pageSize = 10) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException("餐厅不存在");
    }

    const [total, reviews] = await Promise.all([
      this.prisma.restaurantReview.count({
        where: { restaurantId, status: "approved" },
      }),
      this.prisma.restaurantReview.findMany({
        where: { restaurantId, status: "approved" },
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

  async getReviewSummary(restaurantId: string) {
    const [totalReviews, avgResult] = await Promise.all([
      this.prisma.restaurantReview.count({
        where: { restaurantId, status: "approved" },
      }),
      this.prisma.restaurantReview.aggregate({
        where: { restaurantId, status: "approved" },
        _avg: { score: true },
      }),
    ]);

    const topReviews = await this.prisma.restaurantReview.findMany({
      where: { restaurantId, status: "approved" },
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
    restaurantId: string,
    userId: string,
    score: number,
    content?: string,
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException("餐厅不存在");
    }

    const review = await this.prisma.restaurantReview.create({
      data: {
        restaurantId,
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
      if (client) await client.del(`restaurant:detail:${restaurantId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${restaurantId}`, error);
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
      this.prisma.restaurantReview.count({ where: { userId } }),
      this.prisma.restaurantReview.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          restaurant: {
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
        restaurant: {
          id: r.restaurant.id,
          name: r.restaurant.name,
          city: r.restaurant.city,
          thumbnail: r.restaurant.images?.[0] || null,
        },
      })),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  async deleteMyReview(userId: string, reviewId: string) {
    const review = await this.prisma.restaurantReview.findUnique({
      where: { id: reviewId },
      select: { userId: true, restaurantId: true },
    });
    if (!review) {
      throw new NotFoundException("评价不存在");
    }
    if (review.userId !== userId) {
      throw new NotFoundException("评价不存在");
    }
    await this.prisma.restaurantReview.delete({ where: { id: reviewId } });
    try {
      const client = this.redisService.getClient();
      if (client) await client.del(`restaurant:detail:${review.restaurantId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${review.restaurantId}`, error);
    }
    return { success: true };
  }

  // ── 内部方法 ──

  private buildOrderBy(
    sort?: RestaurantSortType,
  ): Prisma.RestaurantOrderByWithRelationInput[] {
    switch (sort) {
      case RestaurantSortType.RATING:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
      case RestaurantSortType.POPULARITY:
        return [{ score: { sort: "desc", nulls: "last" } }, { name: "asc" }];
      case RestaurantSortType.COMPREHENSIVE:
      default:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
    }
  }

  private buildSearchCacheKey(dto: SearchRestaurantsDto): string {
    const hash = crypto
      .createHash("md5")
      .update(
        JSON.stringify({
          k: dto.keyword,
          c: dto.city,
          t: dto.tags,
          cu: dto.cuisine,
          s: dto.sort,
          p: dto.page,
          ps: dto.pageSize,
        }),
      )
      .digest("hex");
    return `restaurant:search:${hash}`;
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

  private async invalidateSearchCache(
    dto: SearchRestaurantsDto,
  ): Promise<void> {
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

    const dedupKey = `restaurant:amap-live:${keyword}:${city || "all"}`;
    if (await this.getCache(dedupKey)) {
      return { processed: 0, inserted: 0 };
    }

    this.logger.log(
      `高德兜底(餐厅): keyword="${keyword}"${city ? ` city="${city}"` : ""}`,
    );

    const pois = await this.fetchAmapPois(keyword, city);
    await this.setCache(dedupKey, true, this.AMAP_DEDUP_TTL);

    if (pois.length === 0) return { processed: 0, inserted: 0 };

    let inserted = 0;
    for (const poi of pois) {
      if (await this.upsertAmapPoi(poi, city)) inserted++;
    }
    this.logger.log(`高德兜底入库(餐厅): 新增 ${inserted} / 处理 ${pois.length}`);
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
    // 餐饮服务大类
    url.searchParams.set("types", "050000");
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

    const data = {
      name,
      city,
      address: fullAddress,
      tags: this.pickAmapTags(poi),
      cuisine: this.pickCuisine(poi),
      score: this.pickAmapScore(poi),
      avgCost: this.pickAvgCost(poi),
      openTime: this.pickText(poi.biz_ext?.open_time) || null,
      images: this.pickAmapImages(poi),
      introduction: null,
      phone: this.pickText(poi.tel) || null,
      lng,
      lat,
      source: "amap-live",
    };

    const existing = await this.prisma.restaurant.findFirst({
      where: { name, city },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.restaurant.update({
        where: { id: existing.id },
        data,
      });
      return false;
    } else {
      await this.prisma.restaurant.create({ data });
      return true;
    }
  }

  private isValidAmapPoi(poi: AmapPoi): boolean {
    const name = this.pickText(poi.name);
    const address = this.pickText(poi.address);
    if (!name || !address) return false;

    const location = this.pickText(poi.location);
    if (!location || !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) return false;

    // 餐厅黑名单：高德返回结果可能混入景点/酒店/超市等
    const nameBlacklist = [
      "景区",
      "公园",
      "博物馆",
      "纪念馆",
      "图书馆",
      "酒店",
      "宾馆",
      "民宿",
      "公寓",
      "停车场",
      "加油站",
      "超市",
      "购物中心",
      "便利店",
      "学校",
      "幼儿园",
      "派出所",
      "营业厅",
      "支行",
      "银行",
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
    const tags = new Set<string>(["餐饮"]);
    const type = this.pickText(poi.type) || "";
    if (type.includes("快餐")) tags.add("快餐");
    if (type.includes("中餐")) tags.add("正餐");
    if (type.includes("小吃")) tags.add("小吃");
    if (type.includes("咖啡")) {
      tags.add("咖啡");
      tags.add("休闲");
    }
    if (type.includes("茶艺") || type.includes("茶馆")) tags.add("茶饮");
    if (type.includes("酒吧")) {
      tags.add("酒吧");
      tags.add("夜生活");
    }
    if (type.includes("糕饼") || type.includes("甜品")) tags.add("甜品");
    if (type.includes("火锅")) tags.add("火锅");
    if (type.includes("烧烤")) tags.add("烧烤");
    return Array.from(tags);
  }

  // 从 AMap type 提取菜系标签（如 "餐饮服务;中餐厅;粤菜" → ["粤菜"]）
  private pickCuisine(poi: AmapPoi): string[] {
    const type = this.pickText(poi.type) || "";
    const cuisines = new Set<string>();
    const known = [
      "粤菜",
      "川菜",
      "湘菜",
      "鲁菜",
      "苏菜",
      "浙菜",
      "闽菜",
      "徽菜",
      "湖北菜",
      "东北菜",
      "西北菜",
      "北京菜",
      "上海菜",
      "云南菜",
      "贵州菜",
      "新疆菜",
      "日韩料理",
      "日本料理",
      "韩国料理",
      "东南亚",
      "意大利",
      "法式",
      "西餐",
      "海鲜",
      "火锅",
      "烧烤",
      "小吃",
      "快餐",
    ];
    for (const c of known) {
      if (type.includes(c)) cuisines.add(c);
    }
    return Array.from(cuisines);
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

  private pickAvgCost(poi: AmapPoi): number | null {
    const raw = this.pickText(poi.biz_ext?.cost);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }
}
