## Why

首页是用户登录后的功能枢纽，承载五大核心功能入口的分发职责。当前 HomePage.vue 仅有静态卡片展示，缺少点击跳转、快捷入口区和状态提示，无法完成 PRD 6.3 定义的"功能入口清晰、点击可跳转对应模块"的验收标准。这是 M2 基础框架的最后交付项，也是 M3 核心工具（智能问答、景点探索）的前置依赖。

## What Changes

- 为五大功能入口卡片添加点击跳转逻辑，每个入口跳转至对应模块路由（路由页面初期可为占位组件）
- 新增快捷入口区：展示热门目的地推荐、最近行程入口、最近对话入口
- 新建各功能模块的占位路由页面，确保跳转可落地
- 新增首页状态提示：加载骨架屏、网络异常提示
- 优化首页在移动端（宽度 <= 768px）的响应式布局

## Capabilities

### New Capabilities
- `home-feature-navigation`: 首页五大功能入口卡片展示与点击跳转，每个入口对应独立路由页面，入口区在 PC 和移动端均可正常使用
- `home-shortcut-area`: 首页快捷入口区，展示热门目的地、最近行程、最近对话的快捷入口，数据异步加载，失败时降级展示默认内容
- `home-loading-states`: 首页加载骨架屏、网络异常提示、空状态占位，覆盖加载中/失败/空数据三种状态

### Modified Capabilities
<!-- 无已有 capabilities 需要修改 -->

## Impact

- 修改现有文件：`client/src/pages/home/HomePage.vue`（添加跳转逻辑、快捷区、状态处理）
- 新增前端路由：`/chat`、`/spots`、`/trips`、`/albums` 及其占位页面组件
- 新增前端页面：`client/src/pages/chat/`、`client/src/pages/spots/`、`client/src/pages/trips/`、`client/src/pages/albums/`（占位组件，后续模块实现时替换）
- 新增前端组件：骨架屏组件、快捷入口卡片组件（可复用）
- 新增路由配置：Vue Router 添加四个功能模块路由，均需 `requiresAuth` 元信息
