export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStreamRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  _signal?: AbortSignal;
}

export interface ChatChunk {
  content: string;
  done: boolean;
  error?: string;
}

export interface LLMProvider {
  chatStream(request: ChatStreamRequest): AsyncIterable<ChatChunk>;
}
