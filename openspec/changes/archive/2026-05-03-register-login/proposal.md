## Why

途灵是面向自由行用户的 AI 智能旅行搭子平台，核心功能（智能问答、景点收藏、行程规划、图片纪念墙）均依赖用户身份体系。注册与登录模块是用户数据隔离、个性化服务和权限控制的基础，也是 PRD 里程碑 M2 "基础框架" 的首要交付项。当前产品无账号体系，所有功能无法关联用户身份，必须优先建立。

## What Changes

- 新增手机号/邮箱注册能力，支持验证码校验、密码复杂度检查、账号唯一性校验
- 新增账号密码登录能力，支持记住密码与自动登录
- 新增 JWT 双 Token 登录态管理（Access Token + Refresh Token），基于 HttpOnly Secure SameSite Cookie
- 新增退出登录能力，清除服务端与客户端登录态
- 新增全局鉴权守卫，未登录用户访问受限功能时被引导至登录页
- 新增游客态与登录态权限隔离：游客仅可访问登录/注册页及公开内容，登录用户可访问全部核心功能

## Capabilities

### New Capabilities
- `auth-register`: 用户通过手机号或邮箱注册途灵账户，包含验证码发送与校验、密码规则校验、账号唯一性校验、注册成功自动登录或跳转登录页
- `auth-login`: 用户通过账号密码登录系统，包含登录态维护（JWT 双 Token）、全局鉴权守卫、游客/登录用户权限隔离、退出登录

### Modified Capabilities
<!-- 首次实现，无已有 capabilities 需要修改 -->

## Impact

- 新增后端模块：`AuthModule`（NestJS）、`UserModule`（用户数据层）
- 新增前端页面：`src/pages/auth/`（登录页、注册页）
- 新增数据库表：`users`、`auth_tokens`
- 新增 API 接口：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`POST /api/auth/captcha`
- 新增依赖：Redis（验证码存储与限流）、bcrypt/argon2（密码哈希）、JWT 库
- 全局路由守卫与权限中间件会影响所有后续页面模块
