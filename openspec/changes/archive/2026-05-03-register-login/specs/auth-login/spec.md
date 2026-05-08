## ADDED Requirements

### Requirement: 用户可通过账号密码登录

系统 SHALL 允许已注册用户使用邮箱/手机号 + 密码登录，校验通过后颁发 JWT Access Token 和 Refresh Token。

#### Scenario: 正确账号密码登录成功
- **WHEN** 用户输入已注册的邮箱/手机号和正确密码，点击登录
- **THEN** 系统颁发 Access Token（15 分钟有效）和 Refresh Token（7 天有效），通过 HttpOnly Secure SameSite Cookie 设置，跳转首页

#### Scenario: 账号不存在
- **WHEN** 用户输入的邮箱或手机号在系统中不存在
- **THEN** 系统提示"账号或密码错误"（模糊化错误信息，不区分账号不存在或密码错误）

#### Scenario: 密码错误
- **WHEN** 用户输入的密码与系统记录不匹配
- **THEN** 系统提示"账号或密码错误"

#### Scenario: 连续登录失败触发限流
- **WHEN** 同一 IP 或同一账号 5 分钟内连续登录失败超过 5 次
- **THEN** 系统拒绝后续登录请求 15 分钟，提示"登录尝试过于频繁，请 15 分钟后再试"

### Requirement: 系统维护登录态并自动刷新

系统 SHALL 在 Access Token 过期时通过 Refresh Token 自动续期，续期时颁发新的 Access Token 和 Refresh Token（Token 轮转）。

#### Scenario: Access Token 过期时自动续期
- **WHEN** 用户的 Access Token 已过期但 Refresh Token 有效
- **THEN** 系统静默刷新 Token，前端无感知，用户可继续使用

#### Scenario: Refresh Token 也过期时要求重新登录
- **WHEN** 用户的 Refresh Token 已过期（超过 7 天未活动）
- **THEN** 系统清除 Cookie，返回 401，前端跳转登录页

#### Scenario: Refresh Token 已被吊销
- **WHEN** 用户的 Refresh Token 在服务端被标记为已吊销
- **THEN** 系统清除 Cookie，返回 401，前端跳转登录页

### Requirement: 用户可退出登录

系统 SHALL 提供退出登录功能，清除客户端 Cookie 并吊销服务端 Refresh Token。

#### Scenario: 正常退出登录
- **WHEN** 已登录用户点击"退出登录"
- **THEN** 系统吊销当前 Refresh Token，清除客户端 Cookie，跳转登录页

#### Scenario: 退出后无法访问私有数据
- **WHEN** 用户退出登录后尝试直接访问需要登录的页面或接口
- **THEN** 系统返回 401 或跳转登录页，不可继续访问用户私有数据

### Requirement: 全局鉴权守卫保护受限资源

系统 SHALL 对所有需要登录的接口实施鉴权拦截，未登录请求返回 401。

#### Scenario: 游客访问受限接口
- **WHEN** 未登录用户（无有效 Token）访问智能问答、景点收藏、行程规划、图片纪念墙等需要登录的接口
- **THEN** 系统返回 401，前端统一拦截并跳转登录页

#### Scenario: 已登录用户正常访问
- **WHEN** 已登录用户（有效 Token）访问任何功能接口
- **THEN** 系统通过鉴权，在 Request 上下文中注入用户 ID，正常处理请求

#### Scenario: Token 被篡改
- **WHEN** 请求携带的 JWT Token 签名无效或被篡改
- **THEN** 系统返回 401，前端清除 Cookie 并跳转登录页

### Requirement: 前端路由守卫控制页面访问权限

前端 SHALL 在 Vue Router 中配置路由元信息和全局前置守卫，根据登录状态决定允许或重定向。

#### Scenario: 未登录用户访问首页
- **WHEN** 未登录用户访问首页路由
- **THEN** 路由守卫重定向至 `/login`

#### Scenario: 已登录用户访问登录/注册页
- **WHEN** 已登录用户（持有有效 Token）访问 `/login` 或 `/register`
- **THEN** 路由守卫重定向至 `/home`（首页）

#### Scenario: 游客可访问公开页
- **WHEN** 未登录用户访问 `/login` 或 `/register`
- **THEN** 路由守卫放行，正常展示页面
