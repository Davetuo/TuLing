import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { ChatService } from "./chat.service";
import { ChatRetrievalService } from "./chat.retrieval.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";

@Controller("api/chat")
export class ChatController {
  constructor(
    private chatService: ChatService,
    private retrievalService: ChatRetrievalService,
  ) {}

  @Post("sessions")
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSessionDto,
  ) {
    const session = await this.chatService.createSession(user.sub, dto.title);
    return { code: 0, data: session };
  }

  @Get("sessions")
  @HttpCode(HttpStatus.OK)
  async getSessions(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const result = await this.chatService.getSessions(
      user.sub,
      Number(page) || 1,
      Math.min(Number(pageSize) || 20, 50),
    );
    return { code: 0, data: result };
  }

  @Get("sessions/:id")
  @HttpCode(HttpStatus.OK)
  async getSession(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const session = await this.chatService.getSession(id, user.sub);
    return {
      code: 0,
      data: {
        id: session.id,
        title: session.title || "新对话",
        summary: session.summary,
        messages: session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.createdAt,
        })),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    };
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    await this.chatService.deleteSession(id, user.sub);
    return { code: 0, data: null };
  }

  @Post("messages")
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    // Content safety check
    if (!this.chatService.checkContentSafety(dto.content)) {
      reply.status(400).send({
        code: 400,
        message: "内容包含不适合处理的信息，请修改后重试",
      });
      return;
    }

    // Get or create session
    let sessionId = dto.sessionId;
    let isNewSession = false;
    if (!sessionId) {
      const session = await this.chatService.createSession(user.sub);
      sessionId = session.id;
      isNewSession = true;
    }

    // Save user message
    const savedUserMsg = await this.chatService.saveUserMessage(
      sessionId,
      dto.content,
    );

    // Set title from first user question (only for new sessions or sessions without title)
    if (isNewSession) {
      await this.chatService.updateSessionTitle(
        sessionId,
        dto.content.length > 30
          ? dto.content.slice(0, 30) + "..."
          : dto.content,
      );
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // ── RAG 检索：根据用户问题查本地数据库，得到候选项 ──
    const intent = this.retrievalService.extractIntent(dto.content);
    const candidates = await this.retrievalService.retrieveCandidates(intent);
    const places = this.retrievalService.toMapMarkers(candidates);
    const grounding = this.retrievalService.buildGroundingContext(
      intent,
      candidates,
    );

    // 把检索到的地图标记先于文本流发给前端 — 这样地图渲染来自真实候选，
    // 而不是再从 LLM 输出文本里用正则抽地名
    if (places.length > 0) {
      const placesData = JSON.stringify({
        type: "places",
        places,
        sessionId,
        userMessageId: savedUserMsg.id,
      });
      reply.raw.write(`data: ${placesData}\n\n`);
    }

    // Build LLM messages from recent context
    const recentMessages = await this.chatService.getRecentMessages(
      sessionId,
      20,
    );

    // 把 grounding 上下文以 system 消息形式注入（在历史消息之前）
    const messagesForLlm = grounding
      ? [
          { role: "system" as const, content: grounding },
          ...recentMessages,
        ]
      : recentMessages;

    let fullContent = "";
    const startTime = Date.now();

    try {
      const abortSignal = new AbortController();

      // Handle client disconnect
      const onClose = () => abortSignal.abort();
      req.raw.on("close", onClose);

      for await (const chunk of this.chatService.chatStream({
        messages: messagesForLlm,
        _signal: abortSignal.signal,
      })) {
        if (chunk.error) {
          const data = JSON.stringify({
            type: "error",
            message: chunk.error,
            sessionId,
            userMessageId: savedUserMsg.id,
          });
          reply.raw.write(`data: ${data}\n\n`);
          break;
        }

        if (chunk.content) {
          fullContent += chunk.content;
          const data = JSON.stringify({
            type: "chunk",
            content: chunk.content,
            sessionId,
            userMessageId: savedUserMsg.id,
          });
          reply.raw.write(`data: ${data}\n\n`);
        }

        if (chunk.done) {
          const duration = Date.now() - startTime;

          if (fullContent) {
            const assistantMsg = await this.chatService.saveAssistantMessage(
              sessionId,
              fullContent,
              {
                duration,
                model: "default",
                ...(places.length > 0 && { places }),
              },
            );

            const data = JSON.stringify({
              type: "done",
              sessionId,
              userMessageId: savedUserMsg.id,
              assistantMessageId: assistantMsg.id,
              duration,
            });
            reply.raw.write(`data: ${data}\n\n`);
          }
          break;
        }
      }

      req.raw.off("close", onClose);
    } catch {
      const data = JSON.stringify({
        type: "error",
        message: "AI 服务请求失败，请稍后重试",
        sessionId,
        userMessageId: savedUserMsg.id,
      });
      reply.raw.write(`data: ${data}\n\n`);
    }

    reply.raw.end();
  }

  @Post("sessions/:id/summary")
  async generateSummary(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    try {
      const messages = await this.chatService.getMessages(id, user.sub);
      if (messages.length < 4) {
        reply.status(400).send({
          code: 400,
          message: "当前对话内容较少，暂无法生成总结",
        });
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "会话不存在";
      reply.status(404).send({ code: 404, message });
      return;
    }

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let fullContent = "";

    try {
      const onClose = () => {};
      req.raw.on("close", onClose);

      for await (const chunk of await this.chatService.generateSummary(
        id,
        user.sub,
      )) {
        if (chunk.error) {
          const data = JSON.stringify({ type: "error", message: chunk.error });
          reply.raw.write(`data: ${data}\n\n`);
          break;
        }

        if (chunk.content) {
          fullContent += chunk.content;
          const data = JSON.stringify({
            type: "chunk",
            content: chunk.content,
          });
          reply.raw.write(`data: ${data}\n\n`);
        }

        if (chunk.done && fullContent) {
          await this.chatService.saveSessionSummary(id, fullContent);

          const data = JSON.stringify({ type: "done", content: fullContent });
          reply.raw.write(`data: ${data}\n\n`);
          break;
        }
      }

      req.raw.off("close", onClose);
    } catch {
      const data = JSON.stringify({
        type: "error",
        message: "智能总结生成失败，请稍后重试",
      });
      reply.raw.write(`data: ${data}\n\n`);
    }

    reply.raw.end();
  }

  @Get("recommendations")
  @HttpCode(HttpStatus.OK)
  async getRecommendations() {
    const defaults = [
      {
        id: "rec-1",
        text: "帮我规划一个3天游杭州的轻松路线",
        category: "行程规划",
      },
      {
        id: "rec-2",
        text: "推荐几个适合周末出行的小众城市",
        category: "目的地推荐",
      },
      {
        id: "rec-3",
        text: "带老人去北京玩，需要注意什么？",
        category: "出行提示",
      },
      {
        id: "rec-4",
        text: "预算1000元，如何安排两天一夜旅行？",
        category: "预算规划",
      },
      {
        id: "rec-5",
        text: "情侣去海边拍照，有哪些推荐的景点？",
        category: "景点推荐",
      },
      {
        id: "rec-6",
        text: "五一假期出游，如何避开人流高峰？",
        category: "出行技巧",
      },
    ];

    return { code: 0, data: { recommendations: defaults } };
  }
}
