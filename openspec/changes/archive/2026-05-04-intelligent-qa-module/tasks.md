## 1. Database & Prisma Schema

- [x] 1.1 Add `chat_sessions` model to Prisma schema (id, user_id, title, summary, created_at, updated_at, relation to User)
- [x] 1.2 Add `chat_messages` model to Prisma schema (id, session_id, role, content, metadata JSONB, created_at, relation to chat_sessions)
- [x] 1.3 Run `prisma migrate dev` to generate migration and apply to dev database
- [x] 1.4 Run `prisma generate` to regenerate Prisma client

## 2. Backend - LLM Provider Adapter

- [x] 2.1 Create `src/provider/provider.module.ts` (NestJS dynamic module with configurable provider)
- [x] 2.2 Create `src/provider/llm-provider.interface.ts` (abstract `chatStream` method returning `AsyncIterable<ChatChunk>`)
- [x] 2.3 Create `src/provider/openai-compat.provider.ts` (OpenAI-compatible implementation: construct messages, call `/v1/chat/completions` with `stream: true`, yield SSE chunks)
- [x] 2.4 Create `src/provider/provider.service.ts` (facade that selects LLM provider by config, provides `chatStream` method)

## 3. Backend - Chat Module Core

- [x] 3.1 Create `src/chat/dto/send-message.dto.ts` (sessionId?, content string, validation: content not empty)
- [x] 3.2 Create `src/chat/dto/create-session.dto.ts` (optional title)
- [x] 3.3 Create `src/chat/chat.service.ts` with methods: `createSession(userId)`, `getSessions(userId, page, pageSize)`, `getSession(sessionId, userId)`, `getMessages(sessionId, userId)`, `saveMessage(sessionId, role, content, metadata)`, `generateSummary(sessionId, userId, messages)`
- [x] 3.4 Create `src/chat/chat.controller.ts` with endpoints:
  - `POST /api/chat/sessions` - create new session
  - `GET /api/chat/sessions` - list user sessions (paginated)
  - `GET /api/chat/sessions/:id` - get session with messages
  - `POST /api/chat/messages` - send message, stream AI reply via SSE (`@Res()` reply.raw write chunks)
  - `POST /api/chat/sessions/:id/summary` - generate summary
  - `GET /api/chat/recommendations` - get recommended questions
- [x] 3.5 Create `src/chat/chat.module.ts` (import ProviderModule, register controller + service)

## 4. Backend - Integration

- [x] 4.1 Register `ChatModule` and `ProviderModule` in `AppModule`
- [x] 4.2 Implement SSE streaming in controller: set headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`), iterate provider `chatStream` and write `data: ...\n\n` to reply.raw, handle client disconnect via `req.raw.on('close')`
- [x] 4.3 Add input content safety check (basic keyword filter in service, or stub for future Provider)
- [x] 4.4 Add LLM error handling: timeout (15s), rate limit, empty response → return structured error to frontend
- [x] 4.5 Add session title auto-generation: set title to truncated first user question (max 30 chars) on first message

## 5. Frontend - Types & API Layer

- [x] 5.1 Create `src/shared/types/chat.ts` (interfaces: ChatSession, ChatMessage, SendMessageRequest, RecommendationsResponse, StreamChunk)
- [x] 5.2 Create `src/shared/api/chat.ts` (functions: createSession, getSessions, getSession, sendMessageSSE, generateSummary, getRecommendations)
- [x] 5.3 Create `src/shared/api/sse.ts` (generic SSE client: `streamChat(url, body, onChunk, onError, onDone)` returning `{ abort }` controller)
- [x] 5.4 Update `src/shared/api/client.ts` if SSE needs different base config (no changes needed)

## 6. Frontend - Chat Page Implementation

- [x] 6.1 Rewrite `src/pages/chat/ChatPage.vue`: two-column layout (sidebar: session list + new chat button; main: chat area + input)
- [x] 6.2 Implement session sidebar: list > load sessions on mount, display title/updateTime/messageCount, click to select, empty state, "新建对话" button at top
- [x] 6.3 Implement chat message area: render message bubbles (user right-aligned blue, AI left-aligned), auto-scroll to bottom on new messages, show loading indicator during AI response
- [x] 6.4 Implement chat input area: `<el-input type="textarea">` + send button + Enter to send, disable during streaming, character count, empty input validation
- [x] 6.5 Implement SSE streaming display: incremental text append, show "停止生成" button during streaming, handle abort, show "AI正在回答..." loading state
- [x] 6.6 Implement stop generation: AbortController → abort SSE connection, preserve partial response, show "已停止生成" indicator
- [x] 6.7 Implement recommendation cards: display in welcome area (new session or empty), click to auto-send, fallback to defaults on API failure
- [x] 6.8 Implement smart summary: button in chat header, call summary API, display in modal or inline with copy button, disable when messages < 4
- [x] 6.9 Handle all error states: network error toast, AI timeout toast + retry, content safety rejection toast, empty state, loading state, session load failure

## 7. Polish & Verification

- [ ] 7.1 Test full flow: create session → send message → receive stream → create new session → open history → continue conversation → generate summary (requires running app)
- [ ] 7.2 Test edge cases: empty input blocked, stop generation works, network disconnect shows error, timeout shows retry (requires running app)
- [x] 7.3 Verify mobile responsive layout (sidebar collapses or overlays on mobile) — implemented: sidebar becomes fixed overlay on <=768px, collapsible
- [x] 7.4 Verify router guard still works (unauthenticated users redirected to login) — confirmed: `/chat` has `meta: { requiresAuth: true }`
