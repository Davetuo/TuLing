## ADDED Requirements

### Requirement: Feature card display
首页 SHALL 展示五大核心功能入口卡片：智能问答、景点探索、景点评价、行程规划、图片纪念墙。每张卡片 MUST 包含图标、功能名称和简短描述。

#### Scenario: Cards render on home page
- **WHEN** 已登录用户访问首页 `/home`
- **THEN** 展示 5 张功能入口卡片，每张包含图标、名称和描述文字

#### Scenario: Cards render on mobile
- **WHEN** 用户在移动浏览器（宽度 <= 768px）访问首页
- **THEN** 功能卡片以两列网格布局展示，卡片内容完整可见

### Requirement: Feature card navigation
点击任意功能入口卡片 SHALL 跳转至对应功能模块页面。

#### Scenario: Click smart Q&A card
- **WHEN** 用户点击"智能问答"卡片
- **THEN** 系统跳转至 `/chat` 路由页面

#### Scenario: Click spot exploration card
- **WHEN** 用户点击"景点探索"卡片
- **THEN** 系统跳转至 `/spots` 路由页面

#### Scenario: Click trip planning card
- **WHEN** 用户点击"行程规划"卡片
- **THEN** 系统跳转至 `/trips` 路由页面

#### Scenario: Click photo wall card
- **WHEN** 用户点击"图片纪念墙"卡片
- **THEN** 系统跳转至 `/albums` 路由页面

### Requirement: Placeholder route pages
每个功能模块路由 SHALL 渲染一个占位页面，展示模块名称和"功能开发中"提示，直到对应模块完成实现。

#### Scenario: Navigate to chat placeholder
- **WHEN** 用户跳转至 `/chat` 且智能问答模块尚未实现
- **THEN** 展示包含"智能问答"标题和开发中提示的占位页面

#### Scenario: Navigate to spots placeholder
- **WHEN** 用户跳转至 `/spots` 且景点探索模块尚未实现
- **THEN** 展示包含"景点探索"标题和开发中提示的占位页面

### Requirement: Auth guard on feature routes
所有功能模块路由 MUST 要求用户已登录，未登录用户访问时 SHALL 被重定向至登录页。

#### Scenario: Unauthenticated user accesses feature route
- **WHEN** 未登录用户直接访问 `/chat`
- **THEN** 系统重定向至 `/login` 页面

### Requirement: Navigation back to home
功能模块占位页面 SHALL 提供返回首页的入口。

#### Scenario: Return to home from placeholder
- **WHEN** 用户在某功能模块占位页面点击返回按钮或浏览器后退
- **THEN** 用户返回首页 `/home`，功能卡片正常展示
