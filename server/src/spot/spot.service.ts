import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { SearchSpotsDto, SpotSortType } from "./dto";
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
export class SpotService {
  private readonly logger = new Logger(SpotService.name);
  private readonly CACHE_TTL = 600; // 10 分钟
  private readonly AMAP_DEDUP_TTL = 300; // 5 分钟内同 keyword 不重复调高德

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private config: ConfigService,
  ) {}

  // ── 景点搜索（含高德兜底）──

  async searchSpots(dto: SearchSpotsDto, userId?: string) {
    let result = await this.queryLocalSpots(dto, userId);

    const keyword = dto.keyword?.trim();
    if (result.items.length === 0 && keyword) {
      const { processed } = await this.fallbackToAmap(keyword, dto.city);
      // 只要高德处理过 POI（新增或更新已存在），都失效缓存并重查本地：
      // 即便 inserted=0（20 条全是 update），之前缓存的空结果会让用户看不到这些记录
      if (processed > 0) {
        await this.invalidateSearchCache(dto);
        result = await this.queryLocalSpots(dto, userId);

        // 仍无结果时,用简化关键词再查一次(去掉括号及内部门店后缀)
        // 例如 "财大小吃街(政院小区店)" 简化为 "财大小吃街"
        let simplified = keyword;
        if (result.items.length === 0) {
          simplified = this.simplifyKeyword(keyword);
          if (simplified && simplified !== keyword) {
            result = await this.queryLocalSpots(
              { ...dto, keyword: simplified },
              userId,
            );
          }
        }

        // 还无结果且有城市约束时,降级为前 2 字模糊匹配
        // 例如 "万松园" 找不到时,用 "万松" 命中 "万松观"、"万松文化园" 等同片区景点
        // 要求 city 存在,避免无约束的短词检索过于发散
        if (
          result.items.length === 0 &&
          dto.city &&
          simplified.length >= 3
        ) {
          const prefix = simplified.slice(0, 2);
          result = await this.queryLocalSpots(
            { ...dto, keyword: prefix },
            userId,
          );
        }
      }
    }

    return result;
  }

  private simplifyKeyword(keyword: string): string {
    return keyword
      .replace(/\(.*?\)/g, "")
      .replace(/（.*?）/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async queryLocalSpots(dto: SearchSpotsDto, userId?: string) {
    const { keyword, city, tags, sort, page = 1, pageSize = 20 } = dto;

    // 尝试从缓存获取
    const cacheKey = this.buildSearchCacheKey(dto);
    const cached = await this.getCache(cacheKey);
    if (cached && !userId) {
      return cached;
    }

    // 构建 WHERE 条件
    const where: Prisma.ScenicSpotWhereInput = {};

    // 如果有关键词，按名称、城市或标签搜索；否则返回所有
    if (keyword && keyword.trim()) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { city: { contains: keyword, mode: "insensitive" } },
        { tags: { has: keyword } },
      ];
    }

    if (city) {
      // 用 contains 而非 equals: 高德入库的城市常带后缀(如"武汉市"),
      // 前端传过来的是短形式(如"武汉"),用 contains 能兼容两端
      where.city = { contains: city, mode: "insensitive" };
    }

    if (tags && tags.length > 0) {
      where.tags = { hasEvery: tags };
    }

    // 构建排序
    const orderBy = this.buildOrderBy(sort);

    // 查询总数和数据
    const [total, items] = await Promise.all([
      this.prisma.scenicSpot.count({ where }),
      this.prisma.scenicSpot.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          tags: true,
          score: true,
          images: true,
          introduction: true,
          openTime: true,
        },
      }),
    ]);

    // 附带收藏状态
    let favoriteSpotIds: Set<string> = new Set();
    if (userId) {
      const favorites = await this.prisma.spotFavorite.findMany({
        where: {
          userId,
          spotId: { in: items.map((item) => item.id) },
        },
        select: { spotId: true },
      });
      favoriteSpotIds = new Set(favorites.map((f) => f.spotId));
    }

    const totalPages = Math.ceil(total / pageSize);
    const result = {
      items: items.map((item) => ({
        ...item,
        score: item.score ? Number(item.score) : null,
        thumbnail: item.images?.[0] || null,
        briefIntro: item.introduction
          ? item.introduction.substring(0, 80) +
            (item.introduction.length > 80 ? "..." : "")
          : null,
        isFavorited: userId ? favoriteSpotIds.has(item.id) : undefined,
      })),
      total,
      totalPages,
      currentPage: page,
    };

    // 缓存结果（不含用户收藏状态）
    if (!userId) {
      await this.setCache(cacheKey, result);
    }

    return result;
  }

  // ── 景点详情 ──

  async getSpotDetail(spotId: string, userId?: string) {
    const cacheKey = `spot:detail:${spotId}`;
    const cached = await this.getCache(cacheKey);

    let spot: any;
    if (cached) {
      spot = cached;
    } else {
      spot = await this.prisma.scenicSpot.findUnique({
        where: { id: spotId },
      });

      if (!spot) {
        throw new NotFoundException("景点不存在");
      }

      spot.score = spot.score ? Number(spot.score) : null;
      await this.setCache(cacheKey, spot);
    }

    // 获取评价摘要
    const reviewSummary = await this.getReviewSummary(spotId);

    // 获取收藏状态
    let isFavorited = false;
    if (userId) {
      const favorite = await this.prisma.spotFavorite.findUnique({
        where: { userId_spotId: { userId, spotId } },
      });
      isFavorited = !!favorite;
    }

    return {
      ...spot,
      reviewSummary,
      isFavorited: userId ? isFavorited : undefined,
    };
  }

  // ── 收藏 ──

  async favoriteSpot(userId: string, spotId: string) {
    // 验证景点存在
    const spot = await this.prisma.scenicSpot.findUnique({
      where: { id: spotId },
    });
    if (!spot) {
      throw new NotFoundException("景点不存在");
    }

    await this.prisma.spotFavorite.upsert({
      where: { userId_spotId: { userId, spotId } },
      create: { userId, spotId },
      update: {},
    });

    // 失效缓存
    await this.invalidateFavoritesCache(userId);

    return { success: true, message: "收藏成功" };
  }

  async unfavoriteSpot(userId: string, spotId: string) {
    await this.prisma.spotFavorite.deleteMany({
      where: { userId, spotId },
    });

    // 失效缓存
    await this.invalidateFavoritesCache(userId);

    return { success: true, message: "已取消收藏" };
  }

  async getFavorites(userId: string, page = 1, pageSize = 20) {
    const [total, favorites] = await Promise.all([
      this.prisma.spotFavorite.count({ where: { userId } }),
      this.prisma.spotFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          spot: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              tags: true,
              score: true,
              images: true,
              introduction: true,
              openTime: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: favorites.map((f) => ({
        ...f.spot,
        score: f.spot.score ? Number(f.spot.score) : null,
        thumbnail: f.spot.images?.[0] || null,
        briefIntro: f.spot.introduction
          ? f.spot.introduction.substring(0, 80) +
            (f.spot.introduction.length > 80 ? "..." : "")
          : null,
        isFavorited: true,
        favoritedAt: f.createdAt,
      })),
      total,
      totalPages,
      currentPage: page,
    };
  }

  // ── 评价 ──

  async getReviews(spotId: string, page = 1, pageSize = 10) {
    // 验证景点存在
    const spot = await this.prisma.scenicSpot.findUnique({
      where: { id: spotId },
    });
    if (!spot) {
      throw new NotFoundException("景点不存在");
    }

    const [total, reviews] = await Promise.all([
      this.prisma.spotReview.count({ where: { spotId, status: "approved" } }),
      this.prisma.spotReview.findMany({
        where: { spotId, status: "approved" },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

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
      totalPages,
      currentPage: page,
    };
  }

  async getReviewSummary(spotId: string) {
    const [totalReviews, avgResult] = await Promise.all([
      this.prisma.spotReview.count({ where: { spotId, status: "approved" } }),
      this.prisma.spotReview.aggregate({
        where: { spotId, status: "approved" },
        _avg: { score: true },
      }),
    ]);

    // 获取热门评价片段（最多5条）
    const topReviews = await this.prisma.spotReview.findMany({
      where: { spotId, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: {
          select: { nickname: true, avatarUrl: true },
        },
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

  // ── 创建评价 ──

  async createReview(
    spotId: string,
    userId: string,
    score: number,
    content?: string,
  ) {
    const spot = await this.prisma.scenicSpot.findUnique({
      where: { id: spotId },
      select: { id: true },
    });
    if (!spot) {
      throw new NotFoundException("景点不存在");
    }

    const review = await this.prisma.spotReview.create({
      data: {
        spotId,
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

    // 失效该景点详情缓存（详情里包含 reviewSummary）
    try {
      const client = this.redisService.getClient();
      if (client) await client.del(`spot:detail:${spotId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${spotId}`, error);
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

  // ── 我的评价 ──

  async getMyReviews(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const [total, reviews] = await Promise.all([
      this.prisma.spotReview.count({ where: { userId } }),
      this.prisma.spotReview.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          spot: {
            select: {
              id: true,
              name: true,
              city: true,
              images: true,
            },
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
        spot: {
          id: r.spot.id,
          name: r.spot.name,
          city: r.spot.city,
          thumbnail: r.spot.images?.[0] || null,
        },
      })),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  async deleteMyReview(userId: string, reviewId: string) {
    const review = await this.prisma.spotReview.findUnique({
      where: { id: reviewId },
      select: { userId: true, spotId: true },
    });
    if (!review) {
      throw new NotFoundException("评价不存在");
    }
    if (review.userId !== userId) {
      // 沿用项目里的语义：不存在 / 无权 一律返回 NotFound 不暴露归属
      throw new NotFoundException("评价不存在");
    }
    await this.prisma.spotReview.delete({ where: { id: reviewId } });
    try {
      const client = this.redisService.getClient();
      if (client) await client.del(`spot:detail:${review.spotId}`);
    } catch (error) {
      this.logger.warn(`详情缓存失效失败: ${review.spotId}`, error);
    }
    return { success: true };
  }

  // ── 我收藏景点的最新评价（别人对我收藏景点写的）──

  async getFavoritesReviews(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const favorites = await this.prisma.spotFavorite.findMany({
      where: { userId },
      select: { spotId: true },
    });
    const spotIds = favorites.map((f) => f.spotId);

    if (spotIds.length === 0) {
      return {
        items: [],
        total: 0,
        totalPages: 0,
        currentPage: safePage,
      };
    }

    const [total, reviews] = await Promise.all([
      this.prisma.spotReview.count({
        where: {
          spotId: { in: spotIds },
          status: "approved",
          userId: { not: userId }, // 排除自己写的，避免和"我的评价"重复
        },
      }),
      this.prisma.spotReview.findMany({
        where: {
          spotId: { in: spotIds },
          status: "approved",
          userId: { not: userId },
        },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          spot: {
            select: {
              id: true,
              name: true,
              city: true,
              images: true,
            },
          },
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
        spot: {
          id: r.spot.id,
          name: r.spot.name,
          city: r.spot.city,
          thumbnail: r.spot.images?.[0] || null,
        },
      })),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  // ── 私有方法 ──

  private buildOrderBy(
    sort?: SpotSortType,
  ): Prisma.ScenicSpotOrderByWithRelationInput[] {
    switch (sort) {
      case SpotSortType.RATING:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
      case SpotSortType.POPULARITY:
        return [{ score: { sort: "desc", nulls: "last" } }, { name: "asc" }];
      case SpotSortType.REVIEW_COUNT:
        // 按评价数倒序；评价数相同时回退到评分
        return [
          { reviews: { _count: "desc" } },
          { score: { sort: "desc", nulls: "last" } },
        ];
      case SpotSortType.COMPREHENSIVE:
      default:
        return [
          { score: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ];
    }
  }

  private buildSearchCacheKey(dto: SearchSpotsDto): string {
    const hash = crypto
      .createHash("md5")
      .update(
        JSON.stringify({
          k: dto.keyword,
          c: dto.city,
          t: dto.tags,
          s: dto.sort,
          p: dto.page,
          ps: dto.pageSize,
        }),
      )
      .digest("hex");
    return `spot:search:${hash}`;
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

  private async invalidateFavoritesCache(userId: string): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      // 删除该用户收藏相关缓存
      const keys = await client.keys(`spot:favorites:${userId}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`收藏缓存失效失败: ${userId}`, error);
    }
  }

  private async invalidateSearchCache(dto: SearchSpotsDto): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      await client.del(this.buildSearchCacheKey(dto));
    } catch (error) {
      this.logger.warn(`搜索缓存失效失败`, error);
    }
  }

  // ─── 高德实时兜底 ───────────────────────────────────────────

  private async fallbackToAmap(
    keyword: string,
    city?: string,
  ): Promise<{ processed: number; inserted: number }> {
    const key = this.config.get<string>("AMAP_WEB_KEY");
    if (!key) {
      this.logger.warn("AMAP_WEB_KEY 未配置，跳过高德兜底");
      return { processed: 0, inserted: 0 };
    }

    // 5 分钟内同 keyword+city 不重复调用高德
    const dedupKey = `spot:amap-live:${keyword}:${city || "all"}`;
    if (await this.getCache(dedupKey)) {
      return { processed: 0, inserted: 0 };
    }

    this.logger.log(
      `高德兜底: keyword="${keyword}"${city ? ` city="${city}"` : ""}`,
    );

    const pois = await this.fetchAmapPois(keyword, city);
    // 即使无结果也设标记，避免 5 分钟内反复打高德
    await this.setCache(dedupKey, true, this.AMAP_DEDUP_TTL);

    if (pois.length === 0) return { processed: 0, inserted: 0 };

    let inserted = 0;
    for (const poi of pois) {
      if (await this.upsertAmapPoi(poi, city)) inserted++;
    }
    this.logger.log(`高德兜底入库: 新增 ${inserted} / 处理 ${pois.length}`);
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
    // 限定为景点类大类：风景名胜/公园/博物馆/纪念馆/寺庙/古迹/文化设施/高校
    // 不传 types 时高德会返回银行/酒店/产业园等非景点 POI
    url.searchParams.set(
      "types",
      "110000|110100|110200|110203|110105|141200|141201",
    );
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

    const data = {
      name,
      city,
      address: fullAddress,
      tags: this.pickAmapTags(poi),
      score: this.pickAmapScore(poi),
      openTime: this.pickText(poi.biz_ext?.open_time) || null,
      images: this.pickAmapImages(poi),
      introduction: null,
      transport: null,
      ticketInfo: this.pickAmapTicketInfo(poi),
      phone: this.pickText(poi.tel) || null,
      suggestedDuration: null,
      source: "amap-live",
    };

    const existing = await this.prisma.scenicSpot.findFirst({
      where: { name, city },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.scenicSpot.update({
        where: { id: existing.id },
        data,
      });
      return false;
    } else {
      await this.prisma.scenicSpot.create({ data });
      return true;
    }
  }

  private isValidAmapPoi(poi: AmapPoi): boolean {
    const name = this.pickText(poi.name);
    const address = this.pickText(poi.address);
    if (!name || !address) return false;

    const location = this.pickText(poi.location);
    if (!location || !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) return false;

    // 名称黑名单：兜底过滤掉混进结果的非景点 POI
    // （即便指定了 types，高德仍可能返回少量边界 POI，如「XX银行支行」位于商业街类目下）
    const nameBlacklist = [
      "银行",
      "支行",
      "酒店",
      "宾馆",
      "民宿",
      "公寓",
      "停车场",
      "售票处",
      "服务区",
      "门店",
      "分店",
      "支店",
      "产业园",
      "开发区",
      "工业园",
      "写字楼",
      "办公楼",
      "公司",
      "集团",
      "分公司",
      "支公司",
      "营业厅",
      "营业部",
      "派出所",
      "石化",
      "加油站",
      "便利店",
      "超市",
      "购物中心",
      "幼儿园",
      "小学",
      "中学",
      "招生",
      "就业处",
    ];
    if (nameBlacklist.some((b) => name.includes(b))) return false;

    return true;
  }

  // 高德很多字段为空时返回 [] 而非 null/空串，统一为 undefined
  private pickText(v: unknown): string | undefined {
    if (v == null || Array.isArray(v)) return undefined;
    const s = String(v).trim();
    return s ? s : undefined;
  }

  private pickAmapTags(poi: AmapPoi): string[] {
    const tags = new Set<string>(["景点"]);
    const type = this.pickText(poi.type) || "";
    if (type.includes("博物馆") || type.includes("纪念馆")) {
      tags.add("文化");
      tags.add("亲子");
    }
    if (type.includes("风景")) tags.add("自然");
    if (type.includes("公园")) {
      tags.add("免费");
      tags.add("自然");
    }
    if (
      type.includes("宗教") ||
      type.includes("寺") ||
      type.includes("庙") ||
      type.includes("观")
    ) {
      tags.add("文化");
    }
    if (type.includes("夜市") || type.includes("步行街")) {
      tags.add("美食");
      tags.add("夜景");
    }
    return Array.from(tags);
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

  private pickAmapTicketInfo(poi: AmapPoi): string | null {
    const cost = this.pickText(poi.biz_ext?.cost);
    if (!cost) return null;
    if (cost === "0" || cost === "免费") return "免费";
    return `参考门票 ¥${cost}`;
  }
}
