## Context

途灵V1.0已具备注册登录、首页功能导航的基础框架。当前`ChatPage.vue`为占位页面，智能问答模块需要从零实现。技术栈已确定：前端Vue 3 + TypeScript + Vite + Element Plus；后端NestJS + Fastify + Prisma + PostgreSQL；AI流式传输采用SSE模式。PRD第6.4节明确定义了智能问答的五个子功能（新建对话、文本输入/AI回复、问题推荐、历史记录、智能总结）及其交互细节、异常处理和验收标准。

## Goals / Non-Goals

**Goals:**
- 实现完整的智能问答闭环：新建会话 → 发送消息 → 流式接收AI回复 → 查看历史 → 继续对话 → 生成总结
- 后端通过LLM Provider Adapter解耦具体模型供应商，V1.0使用OpenAI兼容接口
- 前端支持SSE流式渲染、停止生成、输入校验、错误状态处理
- 数据结构遵循PRD和现有代码风格（Prisma + PostgreSQL JSONB）

**Non-Goals:**
- 不实现多模态输入（图片、语音）——PRD列为V1.0扩展能力
- 不实现游客限次体验——V1.0仅登录用户使用
- 不实现缓存AI回答——V1.0每次重新请求，后续按数据引入
- 不实现WebSocket双向通信——AI输出场景为单向流式

## Decisions

### 1. SSE流式方案：Fetch ReadableStream + 后端NestJS SSE端点

**选择**：前端使用 `fetch()` 的 `ReadableStream` 逐块读取后端SSE端点，后端NestJS controller使用 `@Sse()` 装饰器或直接写Fastify reply stream。

**理由**：比WebSocket轻量，HTTP层面即可实现单向流式输出；无连接管理复杂度；Nginx/Caddy反向代理默认支持SSE透传。PRD要求AI首字 <= 2秒，SSE天然满足。

**替代方案**：WebSocket（双向，但当前不需要）、长轮询（首字慢，不满足性能要求）。

### 2. LLM Provider Adapter模式

**选择**：定义`LLMProvider`抽象接口（`chatStream`方法返回AsyncIterator），创建`OpenAICompatProvider`实现，后续可扩展其他供应商。

**理由**：技术选择文档第8.2节明确要求Provider Adapter模式，避免供应商锁定。NestJS的依赖注入天然适合此模式。

### 3. 数据模型：chat_sessions + chat_messages（JSONB metadata）

**选择**：`chat_sessions`表存会话标题、摘要、更新时间；`chat_messages`表存用户/AI消息，metadata字段使用JSONB存Token用量、模型版本、响应耗时等。

**理由**：PostgreSQL JSONB兼顾结构化和灵活性，后续扩展无需改表。与PRD数据对象定义一致。

### 4. 问题推荐策略：默认列表 + 用户上下文加权

**选择**：后端返回默认推荐问题列表（硬编码 + 后续运营配置）。若用户有收藏景点或历史行程，可加权排序。V1.0不接入推荐算法。

**理由**：MVP阶段保持简单；推荐问题接口失败时前端兜底展示默认列表。

### 5. 会话标题生成

**选择**：会话创建时不生成标题；用户发送首条问题后，将首问截断作为标题（前30字）；可后续由AI优化标题。列表展示时取title字段或兜底"新对话"。

**理由**：简单直接，避免额外AI调用成本。

### 6. 停止生成机制

**选择**：前端使用`AbortController`中断fetch请求；后端在SSE发送循环中检查`req.raw.destroyed`状态，若客户端断开则中断LLM调用。

**理由**：首字响应要求意味着不能等完整结果再返回；实现零额外成本的停止机制。

## Risks / Trade-offs

- **AI超时或输出不稳定** → 后端设置30秒超时，超时后返回错误提示并保留用户输入；前端展示可重试入口
- **SSE代理兼容性** → 后端SSE响应需设置`X-Accel-Buffering: no`（Nginx）；`Cache-Control: no-cache`；`Connection: keep-alive`
- **大上下文导致Token消耗高** → V1.0每次请求携带最近10轮消息（可配置），超出部分裁剪旧消息，保留摘要
- **并发流式请求** → 同一会话限制单线程对话；前端点击新建对话或发送新消息时自动触发AbortController
- **长期数据增长** → chat_messages表按created_at分区或定期归档（V1.1+）；当前数据量级不阻塞V1.0

## Migration Plan

1. 创建Prisma Migration添加`chat_sessions`和`chat_messages`表
2. 运行`prisma migrate deploy`
3. 部署后端代码（新增ChatModule，SSE端点路由已在Nginx配置）
4. 部署前端静态文件（ChatPage完整替换占位页）
5. 无需数据迁移——新表无历史数据依赖
6. 回滚：重新部署旧版即可（新表不影响其他模块）

## Open Questions

1. V1.0使用哪个LLM供应商？（暂时假设OpenAI兼容接口，通过环境变量配置`LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL`）
2. 内容审核接入方式？（建议V1.0预留Provider接口，实际审核规则先做关键词简单过滤）
3. 单用户对话会话数量是否限制？（V1.0暂不限制，依赖前端列表分页）
