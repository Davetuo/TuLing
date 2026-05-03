import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderService } from '../provider/provider.service';
import { ChatMessage } from '../provider/llm-provider.interface';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private providerService: ProviderService,
  ) {}

  async createSession(userId: string, title?: string) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        title: title || '',
      },
    });
  }

  async getSessions(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [sessions, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.chatSession.count({ where: { userId } }),
    ]);

    return {
      list: sessions.map((s) => ({
        id: s.id,
        title: s.title || '新对话',
        summary: s.summary,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('会话不存在');
    return session;
  }

  async getMessages(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId, userId);
    return session.messages;
  }

  async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.chatMessage.create({
      data: { sessionId, role, content, metadata: metadata as object | undefined },
    });
  }

  async saveUserMessage(sessionId: string, content: string) {
    return this.saveMessage(sessionId, 'user', content, { type: 'user_input' });
  }

  async saveAssistantMessage(sessionId: string, content: string, metadata?: Record<string, unknown>) {
    return this.saveMessage(sessionId, 'assistant', content, metadata);
  }

  async getRecentMessages(sessionId: string, limit = 20): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  async updateSessionTitle(sessionId: string, title: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  async saveSessionSummary(sessionId: string, content: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        summary: { content, generatedAt: new Date().toISOString() },
      },
    });
  }

  chatStream(request: Parameters<typeof this.providerService.chatStream>[0]) {
    return this.providerService.chatStream(request);
  }

  checkContentSafety(content: string): boolean {
    // Basic keyword filter — stub for future ContentSafetyProvider
    const blockedWords = ['赌博', '色情', '诈骗', '暴力'];
    const lower = content.toLowerCase();
    return !blockedWords.some((w) => lower.includes(w));
  }

  async generateSummary(sessionId: string, userId: string): Promise<AsyncIterable<import('../provider/llm-provider.interface').ChatChunk>> {
    const messages = await this.getMessages(sessionId, userId);
    if (messages.length < 4) {
      throw new Error('当前对话内容较少，暂无法生成总结');
    }

    const chatMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const summaryPrompt: ChatMessage = {
      role: 'user',
      content: `请对以上对话内容生成结构化旅行总结，按以下格式输出：

## 行程摘要
## Day-by-Day路线
## 交通与时间安排
## 必带物品
## 预算估算
## 风险提醒
## 待确认事项

如果对话中没有涉及某个方面，请注明"暂无相关信息"，不要凭空编造。`,
    };

    return this.providerService.chatStream({
      messages: [
        {
          role: 'system',
          content: '你是旅行总结助手，只基于对话内容生成客观总结，不编造信息。',
        },
        ...chatMessages,
        summaryPrompt,
      ],
      temperature: 0.3,
    });
  }
}
