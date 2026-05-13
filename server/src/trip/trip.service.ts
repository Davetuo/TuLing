import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Trip } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderService } from '../provider/provider.service';
import { CreateTripDto, GenerateNarrativeDto } from './dto';

interface NarrativeResponse {
  summary: string;
  days: Array<{
    day: number;
    theme: string;
    summary: string;
    nodes: Array<{ id: string; note: string }>;
  }>;
}

export type { NarrativeResponse };

@Injectable()
export class TripService {
  private readonly logger = new Logger(TripService.name);

  constructor(
    private prisma: PrismaService,
    private providerService: ProviderService,
  ) {}

  async createTrip(userId: string, dto: CreateTripDto) {
    const trip = await this.prisma.trip.create({
      data: {
        userId,
        title: dto.title,
        destination: dto.destination,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days,
        people: dto.people,
        budget: dto.budget,
        pace: dto.pace,
        preferences: dto.preferences,
        summary: dto.summary,
        dailyPlans: dto.dailyPlans as unknown as Prisma.InputJsonValue,
        budgetItems: dto.budgetItems as unknown as Prisma.InputJsonValue,
        weather: (dto.weather ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.serialize(trip);
  }

  async listTrips(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const [total, items] = await Promise.all([
      this.prisma.trip.count({ where: { userId } }),
      this.prisma.trip.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      items: items.map((t) => this.serialize(t)),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  async getTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('行程不存在或已被删除');
    }
    if (trip.userId !== userId) {
      throw new ForbiddenException('无权查看他人的行程');
    }
    return this.serialize(trip);
  }

  async updateTrip(userId: string, tripId: string, dto: CreateTripDto) {
    const existing = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { userId: true },
    });
    if (!existing) {
      throw new NotFoundException('行程不存在或已被删除');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('无权修改他人的行程');
    }

    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        title: dto.title,
        destination: dto.destination,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days,
        people: dto.people,
        budget: dto.budget,
        pace: dto.pace,
        preferences: dto.preferences,
        summary: dto.summary,
        dailyPlans: dto.dailyPlans as unknown as Prisma.InputJsonValue,
        budgetItems: dto.budgetItems as unknown as Prisma.InputJsonValue,
        weather: (dto.weather ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.serialize(trip);
  }

  async deleteTrip(userId: string, tripId: string) {
    const existing = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { userId: true },
    });
    if (!existing) {
      throw new NotFoundException('行程不存在或已被删除');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('无权删除他人的行程');
    }

    await this.prisma.trip.delete({ where: { id: tripId } });
    return { success: true };
  }

  private serialize(trip: Trip) {
    return {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: trip.days,
      people: trip.people,
      budget: trip.budget,
      pace: trip.pace,
      preferences: trip.preferences,
      summary: trip.summary,
      dailyPlans: trip.dailyPlans as unknown as unknown[],
      budgetItems: trip.budgetItems as unknown as unknown[],
      weather: (trip.weather ?? []) as unknown as unknown[],
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    };
  }

  // ── LLM 文案生成（行程概述 + 每日主题/概述 + 节点推荐理由）──

  async generateNarrative(dto: GenerateNarrativeDto): Promise<NarrativeResponse> {
    const prompt = this.buildNarrativePrompt(dto);

    let raw = '';
    try {
      raw = await this.providerService.chatComplete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.65,
        maxTokens: 4000,
      });
    } catch (err) {
      this.logger.warn(
        `LLM 文案生成失败：${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }

    const parsed = this.tryParseNarrative(raw, dto);
    if (!parsed) {
      this.logger.warn(
        `LLM 返回内容无法解析为 JSON (length=${raw.length})：` +
          `head=${raw.slice(0, 120)} ... tail=${raw.slice(-120)}`,
      );
      throw new Error('LLM 返回内容格式不正确');
    }
    return parsed;
  }

  private buildNarrativePrompt(dto: GenerateNarrativeDto): string {
    const typeLabel: Record<string, string> = {
      spot: '景点',
      meal: '餐饮',
      hotel: '住宿',
    };
    const lines: string[] = [];
    lines.push(`目的地：${dto.destination}`);
    lines.push(`总天数：${dto.days}`);
    if (dto.pace) lines.push(`节奏：${dto.pace}`);
    if (dto.preferences?.length) {
      lines.push(`偏好：${dto.preferences.join('、')}`);
    }
    lines.push('');
    lines.push('行程节点（按天）：');
    for (const day of dto.dailyPlans) {
      lines.push(`Day ${day.day}:`);
      for (const node of day.nodes) {
        const label = typeLabel[node.type] || node.type;
        const category = node.category ? `[${node.category}]` : '';
        lines.push(
          `  - ID=${node.id} ${label} ${node.start}-${node.end} ${node.name} ${category}`.trim(),
        );
      }
    }

    return [
      '你是旅行规划助手"途灵"，请基于以下行程信息生成自然、个性化、有温度的文案。',
      '',
      lines.join('\n'),
      '',
      '请严格返回 JSON（不要任何前后文、不要代码块围栏），结构如下：',
      '{',
      '  "summary": "整个行程概述，60-100 字，点出核心特色、节奏、亮点",',
      '  "days": [',
      '    {',
      '      "day": 1,',
      '      "theme": "当天主题，8-15 字，要有画面感",',
      '      "summary": "当天概述，30-50 字，串联当天节点的逻辑",',
      '      "nodes": [',
      '        { "id": "节点ID保持不变", "note": "推荐理由 20-40 字，结合节点类型和用户偏好，避免套话" }',
      '      ]',
      '    }',
      '  ]',
      '}',
      '',
      '要求：',
      '1. 节点 ID 必须与输入完全一致',
      '2. 餐饮节点的 note 偏向"推荐什么菜/适合什么时段"，避免重复景点描述',
      '3. 住宿节点的 note 偏向"位置/类型适合什么样的人"，不要重复酒店名',
      '4. 景点节点的 note 结合用户偏好（如历史文化/亲子/拍照），具体到当天的玩法',
      '5. 文案要自然口语化，避免"非常推荐"等套话',
    ].join('\n');
  }

  // 解析 LLM 返回的 JSON，容错处理：剥离 ```json``` 围栏、用括号深度扫描定位最外层 {...}
  private tryParseNarrative(
    raw: string,
    dto: GenerateNarrativeDto,
  ): NarrativeResponse | null {
    if (!raw) return null;

    let text = raw.trim();
    // 剥离代码块围栏
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

    const jsonStr = this.extractOutermostJsonObject(text);
    if (!jsonStr) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    const daysRaw = Array.isArray(obj.days) ? obj.days : [];

    const dayMap = new Map<number, NarrativeResponse['days'][number]>();
    for (const d of daysRaw) {
      if (!d || typeof d !== 'object') continue;
      const dObj = d as Record<string, unknown>;
      const dayNum = Number(dObj.day);
      if (!Number.isFinite(dayNum)) continue;

      const theme = typeof dObj.theme === 'string' ? dObj.theme : '';
      const daySummary = typeof dObj.summary === 'string' ? dObj.summary : '';
      const nodesRaw = Array.isArray(dObj.nodes) ? dObj.nodes : [];
      const nodes: Array<{ id: string; note: string }> = [];
      for (const n of nodesRaw) {
        if (!n || typeof n !== 'object') continue;
        const nObj = n as Record<string, unknown>;
        const id = typeof nObj.id === 'string' ? nObj.id : '';
        const note = typeof nObj.note === 'string' ? nObj.note : '';
        if (id && note) nodes.push({ id, note });
      }
      dayMap.set(dayNum, { day: dayNum, theme, summary: daySummary, nodes });
    }

    // 兜底：缺天的话补空对象，确保前端可以安全合并
    const days = dto.dailyPlans.map((dp) => {
      const found = dayMap.get(dp.day);
      return (
        found || {
          day: dp.day,
          theme: '',
          summary: '',
          nodes: [],
        }
      );
    });

    if (!summary && days.every((d) => !d.theme && !d.summary && d.nodes.length === 0)) {
      return null;
    }

    return { summary, days };
  }

  /**
   * 用括号深度扫描定位最外层 {...} 边界。
   *  - 跳过字符串字面量中的花括号（处理转义 \" \\）
   *  - 找不到 depth 归零的位置则返回 null（说明被截断）
   * 比 lastIndexOf('}') 更稳：当 LLM 输出里字符串字段内含 } 时不会错位。
   */
  private extractOutermostJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }

    return null;
  }
}
