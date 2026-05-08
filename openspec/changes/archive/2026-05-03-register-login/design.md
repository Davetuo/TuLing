## Context

途灵后端采用 NestJS + Fastify + TypeScript + Prisma + PostgreSQL，前端采用 Vue 3 + TypeScript + Vite。当前项目处于初始化阶段，无任何业务代码。注册与登录模块是整个产品账号体系的基石——后续智能问答、景点收藏、行程规划、图片纪念墙均依赖用户身份。

技术约束（来自技术选择文档）：
- 鉴权方案：JWT Access Token + Refresh Token，HttpOnly Secure SameSite Cookie
- 密码哈希：bcrypt/argon2
- 验证码：Redis 存储，5 分钟 TTL
- 接口限流：Redis 实现
- API 风格：REST，TypeScript 全栈类型共享

## Goals / Non-Goals

**Goals:**
- 实现手机号/邮箱 + 验证码注册，密码复杂度校验，账号唯一性校验
- 实现账号密码登录，JWT 双 Token 登录态管理
- 实现退出登录，清除服务端 Refresh Token 与客户端 Cookie
- 实现全局 NestJS Guard，拦截未登录请求
- 前端登录/注册页面，表单校验，错误提示，路由拦截

**Non-Goals:**
- 第三方 OAuth 登录（微信、Google 等）— V1.1 考虑
- 忘记密码 / 找回密码流程 — V1.1 考虑
- 多因素认证（MFA）
- 手机号短信验证码（V1.0 使用邮箱验证码或图形验证码，短信接入需额外供应商签约）

## Decisions

### 1. JWT 双 Token 方案：Access Token（短期 15min）+ Refresh Token（长期 7d）

**Why:**
- Access Token 短期降低泄露风险；Refresh Token 长期避免频繁登录
- Refresh Token 存储于 `auth_tokens` 表，可服务端主动吊销
- 比纯 Session 方案更轻量，不依赖 Redis 持久化登录态；比纯 Access Token 更安全

**Alternatives considered:** 纯 Session（Redis 存储）增加运维复杂度且单点故障风险高；单 Token 长有效期泄露风险大。

### 2. Token 传输：HttpOnly + Secure + SameSite=Strict Cookie

**Why:**
- HttpOnly 防止 XSS 读取 Token
- Secure 确保仅 HTTPS 传输
- SameSite=Strict 防 CSRF
- 前端无需手动管理 Token 存储，自动附带

### 3. 验证码：邮箱验证码 + 图形验证码兜底

**Why:**
- V1.0 不接入短信供应商，降低第三方依赖和成本
- 邮箱验证码通过 Nodemailer 发送，Redis 存储，5min TTL
- 开发/测试环境使用控制台输出验证码（免邮件服务配置）

### 4. 注册即自动登录 vs 注册后跳转登录页

选择：注册成功后直接颁发 Token 自动登录进入首页。

**Why:** 减少用户操作步骤，提升注册完成率（PRD 目标 >= 80%）。

### 5. 前端路由守卫 + 后端 Guard 双层鉴权

- 前端：Vue Router `beforeEach` 检查登录态，未登录跳转 `/login`
- 后端：NestJS Guard 校验 Token，返回 401 时前端统一拦截跳转

**Why:** 前端守卫提升用户体验（即时跳转），后端守卫保证接口安全（不可绕过）。

## Risks / Trade-offs

- **Refresh Token 泄露风险** → HttpOnly Cookie + 服务端可吊销 + 定期轮转
- **Redis 不可用影响验证码** → 验证码发送失败时前端明确提示"服务繁忙"，不阻塞注册流程的其他校验
- **Cookie SameSite=Strict 可能影响跨站跳转** → 如从邮件链接跳转登录，需要评估是否降为 Lax
- **密码规则过严导致注册流失** → V1.0 仅要求 8 位含字母数字，不过度限制特殊字符

## Migration Plan

首次实现，无迁移需求。部署步骤：
1. 执行 Prisma Migrate 创建 `users` 和 `auth_tokens` 表
2. 确保 Redis 可用
3. 部署后端（AuthModule 自动注册路由和 Guard）
4. 部署前端（路由守卫生效）

## Open Questions

- 验证码发送邮箱服务选用哪个 SMTP 供应商？（开发环境可用 Ethereal 或控制台输出）
- 是否需要在 V1.0 加入图形验证码（防机器注册）？
- Refresh Token 轮转策略：每次刷新是否同时颁发新 Refresh Token？
