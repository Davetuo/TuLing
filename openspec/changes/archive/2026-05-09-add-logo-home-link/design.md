## Context

途灵前端采用 Vue 3 + TypeScript + Vite + Vue Router（文件系统路由）+ Element Plus。AppLayout.vue 是所有已登录页面的公共布局组件，顶部导航栏包含品牌标题"途灵"和副标题"AI 智能旅行搭子"。当前标题为纯静态 `<h1>` 文本，不可交互。主页路径为 `/home`。

## Goals / Non-Goals

**Goals:**
- 用户在任何使用 AppLayout 的页面，点击"途灵"标题可导航到主页 `/home`
- 保持现有视觉样式完全不变（字体、颜色、大小、布局）
- 提供 cursor: pointer 交互提示

**Non-Goals:**
- 不修改 AuthLayout 中的"途灵"标题（登录/注册页不需要此功能）
- 不添加 hover 动画或额外视觉反馈（保持简洁）
- 不改变路由结构或添加新路由

## Decisions

**方案选择：使用 `<router-link to="/home">` 包裹标题**

- **为什么不用 `@click` + `router.push`**：router-link 是 Vue Router 的声明式导航标准方式，语义化更强，且渲染为 `<a>` 标签，支持浏览器原生行为（如 Ctrl+Click 在新标签打开、右键复制链接）
- **为什么不用原生 `<a href>`**：使用 router-link 可避免页面完整刷新，保持 SPA 体验
- **样式处理**：通过 CSS 重置 router-link 默认的 `<a>` 标签样式（去掉下划线和颜色变化），保持现有外观

## Risks / Trade-offs

- **[风险] router-link 默认 `<a>` 样式可能改变外观** → 通过 scoped CSS 显式重置 `text-decoration: none` 和 `color: inherit` 消除
- **[风险] 用户已在首页时重复点击** → Vue Router 本身会忽略相同路径的导航，无副作用
