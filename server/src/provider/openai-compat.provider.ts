import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatChunk, ChatMessage, ChatStreamRequest, LLMProvider } from './llm-provider.interface';

@Injectable()
export class OpenAICompatProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAICompatProvider.name);

  constructor(private configService: ConfigService) {}

  async *chatStream(request: ChatStreamRequest): AsyncIterable<ChatChunk> {
    const apiUrl = this.configService.get('LLM_API_URL');
    const apiKey = this.configService.get('LLM_API_KEY');
    const model = this.configService.get('LLM_MODEL', 'gpt-3.5-turbo');

    if (!apiUrl || !apiKey) {
      this.logger.warn('LLM not configured, returning fallback response');
      yield { content: 'AI 服务暂未配置，请联系管理员。', done: true };
      return;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个专业的旅行助手"途灵"。你的回答应该：
1. 语言清晰、结构清楚，尽量用分点或卡片式信息呈现。
2. 对路线、时间、费用、交通等给出可执行的建议步骤。
3. 涉及时效性信息（门票、开放时间、天气）时注明"建议出行前再次确认"。
4. 如果用户提供的信息不足，优先追问关键条件（目的地、天数、预算、同行人群）。
5. 不应给出明显不可行或自相矛盾的路线建议。`,
      },
      ...request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    };

    const controller = new AbortController();

    // 15-second first-token timeout
    let timeout: NodeJS.Timeout | null = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // First token received — clear the first-token timeout
      clearTimeout(timeout!);
      timeout = null;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(`LLM API error: ${response.status} ${errorText}`);
        yield { content: '', done: true, error: `AI 服务返回错误 (${response.status})，请稍后重试` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { content: '', done: true, error: 'AI 服务未返回有效数据流，请稍后重试' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check if the request was aborted externally (client disconnect)
        if (request._signal?.aborted) {
          reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { content: delta, done: false };
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }

      yield { content: '', done: true };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort && request._signal?.aborted) {
        // Client disconnected — clean abort
        yield { content: '', done: true };
        return;
      }
      if (isAbort) {
        yield { content: '', done: true, error: 'AI 响应超时，请稍后重试' };
        return;
      }
      this.logger.error('LLM stream error', err);
      yield { content: '', done: true, error: 'AI 服务请求失败，请检查网络后重试' };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
