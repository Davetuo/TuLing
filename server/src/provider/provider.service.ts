import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatChunk, ChatStreamRequest, LLMProvider } from './llm-provider.interface';
import { OpenAICompatProvider } from './openai-compat.provider';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private configService: ConfigService,
    private openAiProvider: OpenAICompatProvider,
  ) {}

  getLLMProvider(): LLMProvider {
    return this.openAiProvider;
  }

  async *chatStream(request: ChatStreamRequest): AsyncIterable<ChatChunk> {
    const provider = this.getLLMProvider();
    yield* provider.chatStream(request);
  }

  // 同步聚合版：将 stream 拼接成完整字符串，配合非流式场景（如 JSON 生成）
  async chatComplete(request: ChatStreamRequest): Promise<string> {
    let result = '';
    let lastError: string | undefined;
    for await (const chunk of this.chatStream(request)) {
      if (chunk.error) lastError = chunk.error;
      if (chunk.content) result += chunk.content;
      if (chunk.done) break;
    }
    if (lastError && !result) {
      throw new Error(lastError);
    }
    return result;
  }
}

