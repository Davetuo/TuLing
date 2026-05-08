import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchSpotsDto, SpotSortType } from './dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SpotService {
  private readonly logger = new Logger(SpotService.name);
  private readonly CACHE_TTL = 600; // 10 分钟

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  // ── 景点搜索 ──

  async searchSpots(dto: SearchSpotsDto, userId?: string) {
    const { keyword, city, tags, sort, page = 1, pageSize = 20 } = dto;

    // 尝试从缓存获取
    const cacheKey = this.buildSearchCacheKey(dto);
    const cached = await this.getCache(cacheKey);
    if (cached && !userId) {
      return cached;
    }

    // 构建 WHERE 条件
    const where: Prisma.ScenicSpotWhereInput = {
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { city: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } },
      ],
    };

    if (city) {
      where.city = { equals: city, mode: 'insensitive' };
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
          ? item.introduction.substring(0, 80) + (item.introduction.length > 80 ? '...' : '')
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
        throw new NotFoundException('景点不存在');
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
    const spot = await this.prisma.scenicSpot.findUnique({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException('景点不存在');
    }

    await this.prisma.spotFavorite.upsert({
      where: { userId_spotId: { userId, spotId } },
      create: { userId, spotId },
      update: {},
    });

    // 失效缓存
    await this.invalidateFavoritesCache(userId);

    return { success: true, message: '收藏成功' };
  }

  async unfavoriteSpot(userId: string, spotId: string) {
    await this.prisma.spotFavorite.deleteMany({
      where: { userId, spotId },
    });

    // 失效缓存
    await this.invalidateFavoritesCache(userId);

    return { success: true, message: '已取消收藏' };
  }

  async getFavorites(userId: string, page = 1, pageSize = 20) {
    const [total, favorites] = await Promise.all([
      this.prisma.spotFavorite.count({ where: { userId } }),
      this.prisma.spotFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
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
          ? f.spot.introduction.substring(0, 80) + (f.spot.introduction.length > 80 ? '...' : '')
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
    const spot = await this.prisma.scenicSpot.findUnique({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException('景点不存在');
    }

    const [total, reviews] = await Promise.all([
      this.prisma.spotReview.count({ where: { spotId, status: 'approved' } }),
      this.prisma.spotReview.findMany({
        where: { spotId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
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
      this.prisma.spotReview.count({ where: { spotId, status: 'approved' } }),
      this.prisma.spotReview.aggregate({
        where: { spotId, status: 'approved' },
        _avg: { score: true },
      }),
    ]);

    // 获取热门评价片段（最多5条）
    const topReviews = await this.prisma.spotReview.findMany({
      where: { spotId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: { nickname: true, avatarUrl: true },
        },
      },
    });

    return {
      totalReviews,
      averageScore: avgResult._avg.score ? Number(avgResult._avg.score.toFixed(1)) : null,
      topReviews: topReviews.map((r) => ({
        id: r.id,
        score: r.score,
        content: r.content ? r.content.substring(0, 100) + (r.content.length > 100 ? '...' : '') : null,
        images: r.images?.slice(0, 3) || [],
        createdAt: r.createdAt,
        user: r.user,
      })),
    };
  }

  // ── 私有方法 ──

  private buildOrderBy(sort?: SpotSortType): Prisma.ScenicSpotOrderByWithRelationInput[] {
    switch (sort) {
      case SpotSortType.RATING:
        return [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
      case SpotSortType.POPULARITY:
        return [{ score: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }];
      case SpotSortType.COMPREHENSIVE:
      default:
        return [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    }
  }

  private buildSearchCacheKey(dto: SearchSpotsDto): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify({ k: dto.keyword, c: dto.city, t: dto.tags, s: dto.sort, p: dto.page, ps: dto.pageSize }))
      .digest('hex');
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

  private async setCache(key: string, data: any): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      await client.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL);
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
}
