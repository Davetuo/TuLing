import { Test, TestingModule } from '@nestjs/testing';
import { SpotService } from './spot.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException } from '@nestjs/common';
import { SpotSortType } from './dto';

describe('SpotService', () => {
  let service: SpotService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;

  const mockSpot = {
    id: 'spot-uuid-1',
    name: '西湖',
    city: '杭州',
    address: '浙江省杭州市西湖区',
    tags: ['免费', '自然'],
    score: 4.8,
    openTime: '全天开放',
    images: ['img1.jpg', 'img2.jpg'],
    introduction: '西湖位于杭州市西部，是中国十大风景名胜之一。',
    transport: '地铁1号线到龙翔桥站',
    ticketInfo: '免费',
    phone: '0571-87977767',
    suggestedDuration: '半天',
    source: 'seed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      scenicSpot: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      spotFavorite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      spotReview: {
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(null), // Redis disabled by default
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpotService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SpotService>(SpotService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  describe('searchSpots', () => {
    it('应该返回分页搜索结果', async () => {
      (prisma.scenicSpot.count as jest.Mock).mockResolvedValue(1);
      (prisma.scenicSpot.findMany as jest.Mock).mockResolvedValue([mockSpot]);

      const result = await service.searchSpots({
        keyword: '西湖',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('西湖');
      expect(result.items[0].thumbnail).toBe('img1.jpg');
    });

    it('应该正确处理空结果', async () => {
      (prisma.scenicSpot.count as jest.Mock).mockResolvedValue(0);
      (prisma.scenicSpot.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.searchSpots({
        keyword: '不存在的景点',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('登录用户应获取收藏状态', async () => {
      (prisma.scenicSpot.count as jest.Mock).mockResolvedValue(1);
      (prisma.scenicSpot.findMany as jest.Mock).mockResolvedValue([mockSpot]);
      (prisma.spotFavorite.findMany as jest.Mock).mockResolvedValue([{ spotId: 'spot-uuid-1' }]);

      const result = await service.searchSpots(
        { keyword: '西湖', page: 1, pageSize: 20 },
        'user-uuid-1',
      );

      expect(result.items[0].isFavorited).toBe(true);
    });

    it('未登录用户不应有收藏状态字段', async () => {
      (prisma.scenicSpot.count as jest.Mock).mockResolvedValue(1);
      (prisma.scenicSpot.findMany as jest.Mock).mockResolvedValue([mockSpot]);

      const result = await service.searchSpots({
        keyword: '西湖',
        page: 1,
        pageSize: 20,
      });

      expect(result.items[0].isFavorited).toBeUndefined();
    });
  });

  describe('getSpotDetail', () => {
    it('应该返回景点完整信息', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(mockSpot);
      (prisma.spotReview.count as jest.Mock).mockResolvedValue(5);
      (prisma.spotReview.aggregate as jest.Mock).mockResolvedValue({ _avg: { score: 4.5 } });
      (prisma.spotReview.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSpotDetail('spot-uuid-1');

      expect(result.name).toBe('西湖');
      expect(result.reviewSummary).toBeDefined();
      expect(result.reviewSummary.totalReviews).toBe(5);
    });

    it('无效 ID 应抛出 NotFoundException', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSpotDetail('invalid-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('favoriteSpot', () => {
    it('应该成功收藏景点', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(mockSpot);
      (prisma.spotFavorite.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.favoriteSpot('user-uuid-1', 'spot-uuid-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('收藏成功');
    });

    it('景点不存在时应抛出 NotFoundException', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.favoriteSpot('user-uuid-1', 'invalid-spot')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unfavoriteSpot', () => {
    it('应该成功取消收藏', async () => {
      (prisma.spotFavorite.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.unfavoriteSpot('user-uuid-1', 'spot-uuid-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('已取消收藏');
    });
  });

  describe('getFavorites', () => {
    it('应该返回用户收藏列表', async () => {
      (prisma.spotFavorite.count as jest.Mock).mockResolvedValue(1);
      (prisma.spotFavorite.findMany as jest.Mock).mockResolvedValue([
        {
          createdAt: new Date(),
          spot: mockSpot,
        },
      ]);

      const result = await service.getFavorites('user-uuid-1', 1, 20);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isFavorited).toBe(true);
    });
  });

  describe('getReviews', () => {
    it('应该返回分页评价列表', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(mockSpot);
      (prisma.spotReview.count as jest.Mock).mockResolvedValue(2);
      (prisma.spotReview.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'review-1',
          score: 5,
          content: '很好',
          images: [],
          createdAt: new Date(),
          user: { id: 'user-1', nickname: '旅行者', avatarUrl: null },
        },
      ]);

      const result = await service.getReviews('spot-uuid-1', 1, 10);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].score).toBe(5);
    });

    it('景点不存在时应抛出 NotFoundException', async () => {
      (prisma.scenicSpot.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReviews('invalid-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
