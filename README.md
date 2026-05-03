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
| 文件存储 | S3 兼容对象存储（计划中） |
| 部署 | Docker Compose |

## 项目结构

```
TuLing/
├── client/                    # Vue 3 前端
│   └── src/
│       ├── pages/
│       │   ├── auth/          # LoginPage, RegisterPage
│       │   └── home/          # HomePage
│       ├── layouts/           # AppLayout, AuthLayout
│       ├── router/            # Vue Router + 路由守卫
│       ├── stores/            # Pinia auth store
│       └── shared/
│           ├── api/           # Axios 封装 + API 方法
│           └── types/         # TypeScript 类型定义
├── server/                    # NestJS 后端
│   ├── prisma/                # Prisma Schema
│   └── src/
│       ├── auth/              # AuthModule (register/login/logout/captcha)
│       ├── user/              # UserModule
│       ├── prisma/            # PrismaModule (数据库)
│       ├── redis/             # RedisModule (缓存/验证码/限流)
│       └── common/            # Guard, Decorator, Filter
├── docs/                      # 产品 PRD & 技术选择文档
├── openspec/                  # OpenSpec 规格文档
├── openqa/                    # OpenQA 测试框架
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
bash scripts/start.sh   # 启动所有服务
```

**Windows PowerShell:**
```powershell
.\scripts\setup.ps1     # 首次：安装依赖 + 初始化环境
.\scripts\start.ps1     # 启动所有服务
```

启动后：
- 前端页面: http://localhost:5173
- 后端 API:  http://localhost:3000
- 按 `Ctrl+C` 停止服务

### 脚本说明

| 脚本 | macOS / Linux | Windows (PowerShell) | Windows (CMD) | 用途 |
|------|---------------|---------------------|----------------|------|
| 一键部署 | `bash scripts/setup.sh` | `.\scripts\setup.ps1` | `scripts\setup.bat` | 安装依赖、初始化 .env、迁移数据库 |
| 一键启动 | `bash scripts/start.sh` | `.\scripts\start.ps1` | `scripts\start.bat` | 拉起 Docker + 后端 + 前端 |
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

## 鉴权方案

- Access Token：15 分钟有效，承载于 HttpOnly Cookie
- Refresh Token：7 天有效，SHA-256 哈希存储，可服务端吊销
- 全局 Guard + `@Public()` 白名单模式
- 前端路由守卫 + 后端接口鉴权双层拦截

## 已实现功能

- [x] 注册/登录模块（邮箱验证码注册、JWT 双 Token 登录、退出登录、全局鉴权守卫）
- [ ] 首页功能导航
- [ ] 智能问答
- [ ] 景点检索
- [ ] 景点评价
- [ ] 行程规划
- [ ] 图片纪念墙

## 测试

```bash
# API 测试（需要后端运行中）
bash openqa/changes/*/test_scripts/api-test.sh

# E2E 测试（需要前后端运行中）
cd client && npx playwright test --config playwright.config.ts
```
