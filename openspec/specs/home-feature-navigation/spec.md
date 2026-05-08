## ADDED Requirements

### Requirement: 功能卡片展示
首页 SHALL 展示五大核心功能入口卡片：智能问答、景点探索、景点评价、行程规划、图片纪念墙。每张卡片 MUST 包含图标、功能名称和简短描述。

#### Scenario: 首页渲染卡片
- **WHEN** 已登录用户访问首页 `/home`
- **THEN** 展示 5 张功能入口卡片，每张包含图标、名称和描述文字

#### Scenario: 移动端渲染卡片
- **WHEN** 用户在移动浏览器（宽度 <= 768px）访问首页
- **THEN** 功能卡片以两列网格布局展示，卡片内容完整可见

### Requirement: 功能卡片导航
点击任意功能入口卡片 SHALL 使用 typed route 名称跳转至对应功能模块页面，导航调用 MUST 通过 TypeScript 编译时类型检查。

#### Scenario: 点击智能问答卡片
- **WHEN** 用户点击"智能问答"卡片
- **THEN** 系统使用 typed route 跳转至 `/chat` 路由页面

#### Scenario: 点击景点探索卡片
- **WHEN** 用户点击"景点探索"卡片
- **THEN** 系统使用 typed route 跳转至 `/spots` 路由页面

#### Scenario: 点击行程规划卡片
- **WHEN** 用户点击"行程规划"卡片
- **THEN** 系统使用 typed route 跳转至 `/trips` 路由页面

#### Scenario: 点击图片纪念墙卡片
- **WHEN** 用户点击"图片纪念墙"卡片
- **THEN** 系统使用 typed route 跳转至 `/albums` 路由页面

#### Scenario: 使用无效路由名称导航
- **WHEN** 开发者在功能卡片配置中使用不存在的 route 名称
- **THEN** TypeScript 编译时报错，阻止构建

### Requirement: 占位路由页面
每个功能模块路由 SHALL 渲染一个占位页面，展示模块名称和"功能开发中"提示，直到对应模块完成实现。

#### Scenario: 跳转至聊天占位页
- **WHEN** 用户跳转至 `/chat` 且智能问答模块尚未实现
- **THEN** 展示包含"智能问答"标题和开发中提示的占位页面

#### Scenario: 跳转至景点占位页
- **WHEN** 用户跳转至 `/spots` 且景点探索模块尚未实现
- **THEN** 展示包含"景点探索"标题和开发中提示的占位页面

### Requirement: 功能路由鉴权守卫
所有功能模块路由 MUST 要求用户已登录，未登录用户访问时 SHALL 被重定向至登录页。

#### Scenario: 未认证用户访问功能路由
- **WHEN** 未登录用户直接访问 `/chat`
- **THEN** 系统重定向至 `/login` 页面

### Requirement: 返回首页导航
功能模块占位页面 SHALL 提供返回首页的入口。

#### Scenario: 从占位页返回首页
- **WHEN** 用户在某功能模块占位页面点击返回按钮或浏览器后退
- **THEN** 用户返回首页 `/home`，功能卡片正常展示
