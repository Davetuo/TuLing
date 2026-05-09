## Why

当前 AppLayout 顶部导航栏中的"途灵"品牌标题仅为静态文本，用户在子页面（如智能问答、景点检索等）时无法通过点击 Logo 快速回到主页，不符合 Web 应用的通用交互惯例。添加点击回主页功能可以提升导航效率和用户体验。

## What Changes

- 将 AppLayout.vue 顶部 header-left 区域的"途灵"标题（h1）包裹为可点击链接，点击后导航到 `/home`
- 添加 cursor: pointer 样式，使用户能识别该元素可交互
- 保持现有视觉样式不变（字体大小、颜色、布局等）

## Capabilities

### New Capabilities

- `logo-home-navigation`: 点击顶部导航栏"途灵"品牌标题可导航回主页

### Modified Capabilities


## Impact

- **前端代码**: `client/src/layouts/AppLayout.vue` — header-left 区域 HTML 结构微调，添加路由跳转逻辑
- **依赖**: 无新增依赖，复用已有的 `vue-router`
- **API**: 无后端变更
- **其他页面**: 所有使用 AppLayout 的页面都将获得此功能
