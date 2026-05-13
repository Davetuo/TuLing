import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type CandidateType = "spot" | "restaurant" | "hotel";

export interface RetrievedCandidate {
  id: string;
  type: CandidateType;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  score: number | null;
  // 类型相关的辅助字段
  tags?: string[];
  cuisine?: string[]; // 餐厅
  avgCost?: number | null; // 餐厅
  starLevel?: number | null; // 酒店
  priceMin?: number | null; // 酒店
  priceMax?: number | null; // 酒店
}

export interface ChatIntent {
  wantSpot: boolean;
  wantRestaurant: boolean;
  wantHotel: boolean;
  city: string | null;
  rawText: string;
}

/**
 * 智能问答的 RAG 检索层：
 *  1) extractIntent 用关键词识别用户意图（要查景点/餐厅/酒店 + 城市）
 *  2) retrieveCandidates 根据意图查本地 Spot/Restaurant/Hotel 表
 *  3) buildGroundingContext 把候选拼成喂给 LLM 的上下文文本
 */
@Injectable()
export class ChatRetrievalService {
  private readonly logger = new Logger(ChatRetrievalService.name);

  // 城市识别词表 — 与前端 RouteMapDialog.pickCity 保持一致
  private readonly CITIES = [
    "武汉", "北京", "上海", "广州", "深圳", "杭州", "南京", "成都",
    "重庆", "西安", "厦门", "苏州", "天津", "三亚", "长沙", "桂林",
    "丽江", "大理", "昆明", "拉萨", "哈尔滨", "青岛", "济南", "郑州",
    "合肥", "福州", "南昌", "贵阳", "兰州", "西宁", "银川", "乌鲁木齐",
    "呼和浩特", "石家庄", "太原", "沈阳", "长春", "海口", "南宁",
  ];

  // 意图关键词
  private readonly HOTEL_KEYWORDS = [
    "酒店", "民宿", "客栈", "宾馆", "住宿", "住的", "住哪", "睡觉",
    "下榻", "旅馆", "hotel",
  ];
  private readonly RESTAURANT_KEYWORDS = [
    "餐厅", "吃", "美食", "小吃", "菜", "饭店", "料理", "馆子",
    "宵夜", "夜宵", "早餐", "午餐", "晚餐", "下午茶", "咖啡", "甜品",
    "火锅", "烧烤", "好吃", "饿了", "馋", "口味", "food", "restaurant",
  ];
  private readonly SPOT_KEYWORDS = [
    "景点", "景区", "玩", "游", "打卡", "游玩", "参观", "拍照",
    "看什么", "去哪", "好玩", "景观", "风景", "spot", "attraction",
  ];

  constructor(private prisma: PrismaService) {}

  extractIntent(text: string): ChatIntent {
    const lower = text.toLowerCase();
    const city = this.CITIES.find((c) => text.includes(c)) ?? null;

    const wantHotel = this.HOTEL_KEYWORDS.some((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    const wantRestaurant = this.RESTAURANT_KEYWORDS.some((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    const wantSpot = this.SPOT_KEYWORDS.some((kw) =>
      lower.includes(kw.toLowerCase()),
    );

    return { wantSpot, wantRestaurant, wantHotel, city, rawText: text };
  }

  async retrieveCandidates(
    intent: ChatIntent,
    limitPerType = 8,
  ): Promise<RetrievedCandidate[]> {
    // 默认行为：如果没明显意图但提了城市，按"行程规划"理解，三类都拉一点
    const askAll =
      !intent.wantSpot &&
      !intent.wantRestaurant &&
      !intent.wantHotel &&
      !!intent.city;

    const tasks: Promise<RetrievedCandidate[]>[] = [];

    if (intent.wantSpot || askAll) {
      tasks.push(this.querySpots(intent.city, limitPerType));
    }
    if (intent.wantRestaurant || askAll) {
      tasks.push(this.queryRestaurants(intent.city, limitPerType));
    }
    if (intent.wantHotel || askAll) {
      tasks.push(this.queryHotels(intent.city, limitPerType));
    }

    if (tasks.length === 0) return [];

    try {
      const results = await Promise.all(tasks);
      return results.flat();
    } catch (err) {
      this.logger.warn("RAG retrieve failed", err);
      return [];
    }
  }

  private async querySpots(
    city: string | null,
    limit: number,
  ): Promise<RetrievedCandidate[]> {
    const where = city
      ? { city: { contains: city, mode: "insensitive" as const } }
      : {};
    const rows = await this.prisma.scenicSpot.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        tags: true,
        score: true,
      },
    });
    // 注意：ScenicSpot 表当前没有 lat/lng 字段，地图渲染时由前端调 amap 现场补全
    return rows.map((r) => ({
      id: r.id,
      type: "spot" as const,
      name: r.name,
      city: r.city,
      address: r.address,
      tags: r.tags,
      score: r.score ? Number(r.score) : null,
      lat: null,
      lng: null,
    }));
  }

  private async queryRestaurants(
    city: string | null,
    limit: number,
  ): Promise<RetrievedCandidate[]> {
    const where = city
      ? { city: { contains: city, mode: "insensitive" as const } }
      : {};
    const rows = await this.prisma.restaurant.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        tags: true,
        cuisine: true,
        avgCost: true,
        score: true,
        lat: true,
        lng: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "restaurant" as const,
      name: r.name,
      city: r.city,
      address: r.address,
      tags: r.tags,
      cuisine: r.cuisine,
      avgCost: r.avgCost,
      score: r.score ? Number(r.score) : null,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
    }));
  }

  private async queryHotels(
    city: string | null,
    limit: number,
  ): Promise<RetrievedCandidate[]> {
    const where = city
      ? { city: { contains: city, mode: "insensitive" as const } }
      : {};
    const rows = await this.prisma.hotel.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        tags: true,
        starLevel: true,
        priceMin: true,
        priceMax: true,
        score: true,
        lat: true,
        lng: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "hotel" as const,
      name: r.name,
      city: r.city,
      address: r.address,
      tags: r.tags,
      starLevel: r.starLevel,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      score: r.score ? Number(r.score) : null,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
    }));
  }

  /**
   * 把候选拼成 system prompt 的 grounding 段落。
   * 设计原则：
   *  - 给 LLM 真实店名/价格/评分，让它"挑选"而不是"编造"
   *  - 明确要求 LLM 只推荐这些候选里的项
   *  - 不限制 LLM 的语言风格（保留它的引导和解说）
   */
  buildGroundingContext(
    intent: ChatIntent,
    candidates: RetrievedCandidate[],
  ): string | null {
    if (candidates.length === 0) return null;

    const lines: string[] = [];
    lines.push("以下是当前数据库里检索到的真实候选数据，请基于它们回答用户：");
    lines.push("");

    const groups: Record<CandidateType, RetrievedCandidate[]> = {
      spot: [],
      restaurant: [],
      hotel: [],
    };
    for (const c of candidates) groups[c.type].push(c);

    if (groups.spot.length > 0) {
      lines.push(`【景点候选 (${groups.spot.length})】`);
      for (const c of groups.spot) {
        const parts = [`- ${c.name}`];
        if (c.city) parts.push(`位于${c.city}`);
        if (c.score) parts.push(`评分 ${c.score.toFixed(1)}`);
        if (c.tags && c.tags.length > 0)
          parts.push(`标签:${c.tags.slice(0, 3).join("/")}`);
        if (c.address) parts.push(`地址:${c.address}`);
        lines.push(parts.join("，"));
      }
      lines.push("");
    }

    if (groups.restaurant.length > 0) {
      lines.push(`【餐厅候选 (${groups.restaurant.length})】`);
      for (const c of groups.restaurant) {
        const parts = [`- ${c.name}`];
        if (c.city) parts.push(`位于${c.city}`);
        if (c.cuisine && c.cuisine.length > 0)
          parts.push(`菜系:${c.cuisine.join("/")}`);
        if (c.avgCost) parts.push(`人均¥${c.avgCost}`);
        if (c.score) parts.push(`评分 ${c.score.toFixed(1)}`);
        if (c.address) parts.push(`地址:${c.address}`);
        lines.push(parts.join("，"));
      }
      lines.push("");
    }

    if (groups.hotel.length > 0) {
      lines.push(`【酒店候选 (${groups.hotel.length})】`);
      for (const c of groups.hotel) {
        const parts = [`- ${c.name}`];
        if (c.city) parts.push(`位于${c.city}`);
        if (c.starLevel) parts.push(`${c.starLevel}星`);
        if (c.priceMin && c.priceMax)
          parts.push(`¥${c.priceMin}-${c.priceMax}/晚`);
        else if (c.priceMin) parts.push(`¥${c.priceMin}起/晚`);
        if (c.score) parts.push(`评分 ${c.score.toFixed(1)}`);
        if (c.address) parts.push(`地址:${c.address}`);
        lines.push(parts.join("，"));
      }
      lines.push("");
    }

    lines.push("回答要求：");
    lines.push("1. 只能推荐上面列出的候选项，不要编造数据库里不存在的名字");
    lines.push("2. 推荐时自然地引用名字、评分、价格等信息");
    lines.push("3. 用户问的是哪一类（景点/餐厅/酒店），就重点回答哪一类");
    lines.push("4. 不需要列出全部，挑 3-5 个最匹配的即可");

    return lines.join("\n");
  }

  /**
   * 把候选转换成前端地图直接渲染需要的精简结构
   */
  toMapMarkers(candidates: RetrievedCandidate[]) {
    return candidates
      .filter((c) => c.lat !== null && c.lng !== null)
      .map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        city: c.city,
        address: c.address,
        lat: c.lat as number,
        lng: c.lng as number,
        score: c.score,
      }));
  }
}
