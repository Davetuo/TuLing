## Why

智能问答（Chat）页面当前没有返回主界面的入口，用户进入聊天界面后只能依赖浏览器的后退按钮返回首页。这在移动端尤为不便，影响用户体验的流畅性和导航的可发现性。需要在聊天页面提供明确的返回按钮，使用户可以快速回到首页。

## What Changes

- 在 ChatPage 头部左侧新增一个"返回首页"按钮（图标+文字）
- 点击按钮通过 Vue Router 导航至 `/home`
- 按钮样式与现有页面设计风格保持一致（Element Plus 图标风格）
- 移动端响应式适配，确保按钮在小屏幕上也可正常使用

## Capabilities

### New Capabilities
- `chat-back-navigation`: 智能问答页面返回主界面的导航能力，包括按钮展示、点击交互和路由跳转

### Modified Capabilities

## Impact

- 修改文件：`/client/src/pages/chat/ChatPage.vue`（新增按钮元素和样式）
- 涉及组件：chat-header 区域
- 无 API 变更，无依赖新增
- 无破坏性变更
