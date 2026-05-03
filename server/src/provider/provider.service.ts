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
}
