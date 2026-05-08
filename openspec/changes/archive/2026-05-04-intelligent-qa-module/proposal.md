## Why

途灵V1.0目前缺少智能问答模块的实际功能实现——当前`ChatPage.vue`只是占位页面。智能问答是产品核心体验（"AI旅行搭子"），用户需要通过对话获得旅行咨询、攻略生成、路线建议和对话总结。V1.0范围明确要求实现新建对话、文本输入、问题推荐、历史记录和智能总结五个子功能，这是产品MVP闭环的关键一环。

## What Changes

- 新建对话：用户可以创建新会话，系统生成唯一会话ID，前端清空上下文并展示欢迎语与推荐问题
- 文本输入与AI流式回复：用户通过聊天输入框发送问题，后端通过SSE流式转发AI回复，支持停止生成。前端渲染用户消息气泡和增量AI回答
- 问题推荐：新对话或闲置时展示热门/个性化问题卡片，用户点击卡片自动发送问题
- 对话历史记录：按时间倒序展示历史会话列表，点击某条会话加载完整问答内容，可继续提问
- 智能总结：对当前长对话一键生成结构化总结（行程摘要、Day-by-Day路线、交通与时间安排、必带物品、预算估算、风险提醒、待确认事项）
- 后端新增ChatModule（chat_sessions、chat_messages表），LLM Provider Adapter抽象层，SSE流式传输端点
- 前端ChatPage从占位页重写为完整聊天界面

## Capabilities

### New Capabilities
- `chat-new-session`: 新建对话，创建唯一会话ID，清空当前上下文
- `chat-message-stream`: 文本输入发送，SSE流式接收AI回复，支持停止生成
- `chat-recommendations`: 热门/个性化问题推荐卡片展示与点击发送
- `chat-history`: 查看历史会话列表，进入历史会话继续提问
- `chat-summary`: 对当前对话生成结构化AI总结

### Modified Capabilities
<!-- None - all capabilities are new for V1.0 -->

## Impact

- 后端：新增`ChatModule`含Controller/Service/Prisma Schema/Provider Adapter；新增SSE端点`/api/chat/messages`；在`AppModule`中注册新模块；新增Prisma Migration（chat_sessions、chat_messages表）
- 前端：重写`ChatPage.vue`为完整聊天界面；新增`src/shared/api/chat.ts`；新增`src/shared/api/sse.ts`（SSE封装）；新增`src/shared/types/chat.ts`；可能新增`src/components/chat/`子组件目录
- 基础设施：LLM Provider适配模式（先使用OpenAI兼容接口），不锁定供应商；Redis可用于热点问题缓存；Sentry追踪AI调用
