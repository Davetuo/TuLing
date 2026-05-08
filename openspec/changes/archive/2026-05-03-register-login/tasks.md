## 1. 后端项目初始化

- [x] 1.1 初始化 NestJS + Fastify + TypeScript 项目，安装核心依赖（@nestjs/core、@nestjs/platform-fastify、Prisma、JWT、bcrypt、class-validator）
- [x] 1.2 配置 TypeScript strict 模式、ESLint、Prettier
- [x] 1.3 配置环境变量管理（.env）：数据库连接、Redis 连接、JWT Secret、SMTP 配置
- [x] 1.4 搭建统一日志、异常过滤器（GlobalExceptionFilter）、健康检查接口 GET /health

## 2. 数据库与 Prisma Schema

- [x] 2.1 创建 Prisma Schema：`users` 表（id、email、phone、password_hash、nickname、avatar_url、status、created_at、updated_at）
- [x] 2.2 创建 Prisma Schema：`auth_tokens` 表（id、user_id、refresh_token_hash、expires_at、revoked_at、created_at）
- [x] 2.3 执行 Prisma Migrate 生成迁移文件并同步数据库
- [x] 2.4 创建 PrismaModule（全局）和 PrismaService

## 3. Redis 模块

- [x] 3.1 安装 ioredis 并创建 RedisModule（全局），封装 RedisService
- [x] 3.2 实现验证码存取方法：setCaptcha(email/phone, code, ttl=300)、verifyCaptcha(email/phone, code)
- [x] 3.3 实现登录限流计数方法：recordLoginFailure(ip/account, ttl=900)、isLoginBlocked(ip/account)

## 4. AuthModule 核心实现

- [x] 4.1 创建 AuthModule、AuthController（POST /api/auth/register、login、logout、captcha）、AuthService
- [x] 4.2 实现 AuthService.register：校验账号唯一性、密码哈希（bcrypt）、创建用户、颁发 Token
- [x] 4.3 实现 AuthService.login：校验账号密码、检查账号状态、限流检查、颁发 Token
- [x] 4.4 实现 AuthService.logout：吊销 Refresh Token、清除 Cookie
- [x] 4.5 实现 AuthService.refreshToken：验证 Refresh Token、轮转颁发新 Token 对
- [x] 4.6 实现 AuthService.sendCaptcha：生成 6 位验证码、60s 发送间隔校验、存储 Redis（5min TTL）

## 5. JWT 与 Token 管理

- [x] 5.1 安装 @nestjs/jwt 并创建 JwtService 封装：生成 Access Token（15min）、生成 Refresh Token（7d）
- [x] 5.2 实现 Refresh Token 服务端存储：SHA-256 哈希后写入 auth_tokens 表
- [x] 5.3 实现 Token Cookie 设置工具：HttpOnly、Secure、SameSite=Strict、Path=/

## 6. 鉴权守卫与中间件

- [x] 6.1 创建 JwtAuthGuard：解析 Access Token，注入 req.user（userId、email）
- [x] 6.2 创建 @Public() 装饰器标记无需鉴权的路由（注册、登录、验证码）
- [x] 6.3 全局注册 Guard（APP_GUARD），配合 @Public() 实现白名单模式
- [x] 6.4 创建 CurrentUser 装饰器，方便 Controller 获取当前登录用户

## 7. 输入校验 DTO

- [x] 7.1 创建 RegisterDto：email/phone 格式校验、password 长度和复杂度校验、username 非空校验
- [x] 7.2 创建 LoginDto：account（邮箱或手机号格式校验）、password 非空
- [x] 7.3 创建 SendCaptchaDto：email 格式校验、60s 发送间隔
- [x] 7.4 全局启用 ValidationPipe，400 错误返回统一格式

## 8. 前端项目初始化

- [x] 8.1 使用 Vite 创建 Vue 3 + TypeScript 项目，安装 Vue Router、Pinia、Axios、Element Plus
- [x] 8.2 配置 Vite：路径别名 @/、devServer proxy（API 代理到后端）、build 优化
- [x] 8.3 创建项目目录结构：pages/auth/、shared/api/、shared/components/、shared/types/、stores/

## 9. 前端 API 层与类型

- [x] 9.1 创建 shared/types/auth.ts：RegisterRequest、LoginRequest、UserInfo、ApiResponse 等类型
- [x] 9.2 封装 Axios 实例：baseURL、timeout、请求拦截器（Cookie 自动携带）、响应拦截器（401 统一处理）
- [x] 9.3 创建 shared/api/auth.ts：register()、login()、logout()、sendCaptcha() API 方法

## 10. 前端 Auth Store（Pinia）

- [x] 10.1 创建 stores/auth.ts：user、isLoggedIn、login()、register()、logout()、fetchUser() 状态管理
- [x] 10.2 实现登录状态持久化：页面刷新时通过 /api/auth/me 或尝试 refresh 恢复登录态

## 11. 前端登录页

- [x] 11.1 创建 pages/auth/LoginPage.vue：账号输入框、密码输入框、记住密码复选框、登录按钮
- [x] 11.2 实现表单校验：账号非空、密码非空、格式校验
- [x] 11.3 实现登录流程：调用 login API → 存储用户信息至 Pinia → 跳转首页
- [x] 11.4 处理错误状态：网络异常提示、账号密码错误提示、限流提示

## 12. 前端注册页

- [x] 12.1 创建 pages/auth/RegisterPage.vue：邮箱/手机号、验证码（含获取按钮+倒计时）、用户名、密码、确认密码、协议勾选
- [x] 12.2 实现表单校验：邮箱格式、密码规则（>=8 位含字母数字）、确认密码一致性、协议必勾选
- [x] 12.3 实现验证码获取：调用 sendCaptcha API → 按钮 60s 倒计时 → 过期可重发
- [x] 12.4 实现注册流程：调用 register API → 自动登录 → 跳转首页
- [x] 12.5 处理错误状态：账号已存在、验证码错误/过期、网络异常、密码不符合规则

## 13. 前端路由守卫

- [x] 13.1 配置 Vue Router：login、register、home 路由，其他路由先占位（使用 meta.requiresAuth）
- [x] 13.2 实现 router.beforeEach：未登录访问需鉴权页面 → 跳转 /login；已登录访问 auth 页 → 跳转 /home
- [x] 13.3 Axios 响应拦截器：收到 401 时清除 Pinia 登录态并跳转 /login

## 14. 前端通用组件与布局

- [x] 14.1 创建 AppLayout.vue：顶部导航栏（Logo、用户信息、退出登录）+ router-view
- [x] 14.2 创建 AuthLayout.vue：居中卡片式布局，用于登录/注册页
- [x] 14.3 退出登录按钮：点击 → 调用 logout API → 清除 Pinia → 跳转 /login

## 15. 集成测试与验收

- [ ] 15.1 端到端测试：注册新用户 → 退出登录 → 用该账号登录 → 访问首页
- [ ] 15.2 异常测试：重复注册、错误验证码、错误密码、未登录访问受限接口
- [ ] 15.3 限流测试：连续错误密码触发限流、验证码 60s 发送间隔
- [ ] 15.4 验证所有验收标准与 PRD 6.1.7 和 6.2.4 对齐
