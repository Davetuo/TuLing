# 途灵 — AI 智能旅行搭子

基于 AI Agent 驱动的智能旅行搭子平台，为自由行用户提供 AI 旅行规划、智能问答、景点探索与旅行记忆管理。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus |
| 后端 | NestJS + Fastify + TypeScript + Prisma |
| 数据库 | PostgreSQL 16 |
| 缓存/限流 | Redis 7 |
| 鉴权 | JWT (Access + Refresh Token), HttpOnly Cookie |
| AI 大模型 | OpenAI 兼容 API（流式响应 + SSE） |
| 部署 | Docker Compose |

## 项目结构

```
TuLing/
├── client/                    # Vue 3 前端
│   ├── e2e/                   # Playwright E2E 测试
│   └── src/
│       ├── pages/
│       │   ├── auth/          # LoginPage, RegisterPage
│       │   ├── home/          # HomePage（功能导航 + 快捷入口）
│       │   ├── chat/          # ChatPage（智能问答）
│       │   ├── spots/         # SpotListPage（景点探索，占位）
│       │   ├── trips/         # TripListPage（行程规划，占位）
│       │   └── albums/        # AlbumListPage（纪念墙，占位）
│       ├── layouts/           # AppLayout, AuthLayout
│       ├── router/            # Vue Router + 路由守卫
│       ├── stores/            # Pinia auth store
│       └── shared/
│           ├── api/           # Axios 封装 + Token 刷新 + SSE 流式客户端
│           ├── components/    # 共享组件
│           └── types/         # TypeScript 类型定义
├── server/                    # NestJS 后端
│   ├── prisma/                # Prisma Schema + 数据迁移
│   └── src/
│       ├── auth/              # AuthModule（注册/登录/登出/验证码/Token刷新）
│       ├── chat/              # ChatModule（会话管理/消息流/智能总结/推荐）
│       ├── user/              # UserModule
│       ├── prisma/            # PrismaModule（数据库服务）
│       ├── redis/             # RedisModule（缓存/验证码/限流）
│       ├── provider/          # ProviderModule（LLM 抽象层 + OpenAI 兼容适配器）
│       └── common/            # Guard, Decorator, Filter, Interceptor
├── scripts/                   # 运维脚本（setup/start/stop/cleanup/prod）
├── docs/                      # 产品 PRD & 技术选择文档
├── openspec/                  # OpenSpec 规格文档
└── docker-compose.yml         # PostgreSQL + Redis
```

## 快速开始

### 前置条件

- Node.js >= 20
- Docker Desktop

### 一键启动（推荐）

**macOS / Linux:**
```bash
bash scripts/setup.sh   # 首次：安装依赖 + 初始化环境
bash scripts/start.sh   # 启动所有服务（开发模式）
```

**Windows PowerShell:**
```powershell
.\scripts\setup.ps1     # 首次：安装依赖 + 初始化环境
.\scripts\start.ps1     # 启动所有服务（开发模式）
```

启动后：
- 前端页面: http://localhost:5173
- 后端 API: http://localhost:3000
- 按 `Ctrl+C` 停止服务

### 生产模式启动

将前端构建产物与后端打包为单端口（3000）服务，适合部署：

**macOS / Linux:**
```bash
bash scripts/start-prod.sh
```

**Windows PowerShell:**
```powershell
.\scripts\start-prod.ps1
```

**Windows CMD:**
```cmd
scripts\start-prod.bat
```

启动后访问 http://localhost:3000 即可使用完整应用。

### 脚本说明

| 脚本 | macOS / Linux | Windows (PowerShell) | Windows (CMD) | 用途 |
|------|---------------|---------------------|----------------|------|
| 一键部署 | `bash scripts/setup.sh` | `.\scripts\setup.ps1` | `scripts\setup.bat` | 安装依赖、初始化 .env、迁移数据库 |
| 一键启动(开发) | `bash scripts/start.sh` | `.\scripts\start.ps1` | `scripts\start.bat` | 拉起 Docker + 后端(dev) + 前端(dev) |
| 一键启动(生产) | `bash scripts/start-prod.sh` | `.\scripts\start-prod.ps1` | `scripts\start-prod.bat` | 构建前端 + 后端生产模式（单端口 3000） |
| 一键停止 | `bash scripts/stop.sh` | `.\scripts\stop.ps1` | `scripts\stop.bat` | 停止服务，保留所有数据 |
| 一键清理 | `bash scripts/cleanup.sh` | `.\scripts\cleanup.ps1` | `scripts\cleanup.bat` | 停止服务 + 删除数据和产物（不可逆） |

### 手动启动（备选）

<details>
<summary>展开手动步骤</summary>

#### 1. 启动基础设施
```bash
docker compose up -d
```

#### 2. 初始化数据库
```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev
```

#### 3. 启动后端
```bash
cd server
npm run start:dev
# → http://localhost:3000
```

#### 4. 启动前端
```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

</details>

## 环境变量

参考 `server/.env.example`，关键配置项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:postgres@localhost:5432/tuling` |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接 | `localhost` / `6379` |
| `JWT_ACCESS_SECRET` | JWT Access Token 密钥 | 需自行设置 |
| `JWT_REFRESH_SECRET` | JWT Refresh Token 密钥 | 需自行设置 |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔） | `http://localhost:5173` |
| `LLM_API_URL` | LLM API 地址（OpenAI 兼容） | 需自行设置 |
| `LLM_API_KEY` | LLM API 密钥 | 需自行设置 |
| `LLM_MODEL` | LLM 模型名称 | `gpt-3.5-turbo` |
| `SMTP_*` | 邮箱验证码 SMTP 配置 | 需自行设置 |

> **注意：** 未配置 LLM 时，智能问答会返回 "AI 服务暂未配置" 的提示。

## API 接口

### 认证 `/api/auth`

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/captcha` | 发送邮箱验证码 | 公开 |
| POST | `/api/auth/register` | 注册新用户 | 公开 |
| POST | `/api/auth/login` | 账号密码登录 | 公开 |
| POST | `/api/auth/logout` | 退出登录 | 需登录 |
| POST | `/api/auth/refresh` | 刷新 Token | 公开 |
| GET | `/api/auth/me` | 获取当前用户信息 | 需登录 |

### 智能问答 `/api/chat`

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/chat/sessions` | 创建新会话 | 需登录 |
| GET | `/api/chat/sessions` | 获取会话列表（分页） | 需登录 |
| GET | `/api/chat/sessions/:id` | 获取会话详情（含历史消息） | 需登录 |
| POST | `/api/chat/messages` | 发送消息（SSE 流式响应） | 需登录 |
| POST | `/api/chat/sessions/:id/summary` | 生成会话智能总结（SSE） | 需登录 |
| GET | `/api/chat/recommendations` | 获取推荐提问列表 | 需登录 |

## 鉴权方案

- Access Token：15 分钟有效，承载于 HttpOnly Cookie
- Refresh Token：7 天有效，SHA-256 哈希存储，可服务端吊销
- 全局 Guard + `@Public()` 白名单模式
- 前端 Axios 拦截器自动刷新 Token（并发请求排队合并）

## 已实现功能

- [x] 注册/登录模块（邮箱验证码注册、JWT 双 Token 登录、退出登录、全局鉴权守卫）
- [x] 首页功能导航（功能卡片、热门目的地快捷入口、网络状态检测）
- [x] 智能问答（LLM 流式对话、SSE 实时推送、多轮会话管理、对话历史、智能总结、推荐提问）
- [x] 网络部署（CORS 动态配置、Vite 局域网绑定、生产模式单端口托管、局域网 IP 展示）
- [x] 运维脚本（一键部署/启动/停止/清理，支持 Bash/PowerShell/CMD 三种终端）
- [ ] 景点探索
- [ ] 景点评价
- [ ] 行程规划
- [ ] 图片纪念墙

## 测试

```bash
# E2E 测试（需要前后端运行中）
cd client && npx playwright test --config playwright.config.ts
```
