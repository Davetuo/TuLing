## Context

智能问答页面（`ChatPage.vue`）的头部区域（`chat-header`）分为左右两部分：
- 左侧（`chat-header-left`）：包含侧边栏切换按钮和当前对话标题
- 右侧（`chat-header-actions`）：包含摘要按钮等操作

当前用户进入聊天页面后，除浏览器后退外无法快速返回首页。项目使用 Vue 3 + Vue Router + Element Plus，路由名为 `Home`，路径为 `/home`。

## Goals / Non-Goals

**Goals:**
- 在聊天页面头部提供清晰可见的返回首页按钮
- 与现有 Element Plus 风格保持一致
- 移动端友好，触控区域足够大

**Non-Goals:**
- 不实现全局导航栏或面包屑（属于更大的导航改造范围）
- 不修改 AppLayout 头部组件
- 不改变路由结构或添加新路由

## Decisions

### 1. 按钮位置：chat-header-left 最左侧

**选择**：将返回按钮放在 `chat-header-left` 的最前面，位于侧边栏切换按钮之前。

**理由**：
- 符合用户对"返回"按钮位于左上角的心智模型
- 无论侧边栏是否折叠，按钮始终可见
- 备选方案（放在标题右侧）会与操作按钮混淆

### 2. 按钮形式：图标按钮 + Tooltip

**选择**：使用 Element Plus 的 `el-button`（text 类型）+ `ArrowLeft` 图标，hover 时显示 tooltip "返回首页"。

**理由**：
- 图标按钮节省空间，ArrowLeft 图标语义明确
- Tooltip 为不熟悉图标的用户提供文字提示
- 备选方案（图标+文字）在小屏幕上会占用过多空间

### 3. 导航方式：router.push

**选择**：使用 `router.push({ name: 'Home' })` 进行导航。

**理由**：
- 使用命名路由避免硬编码路径
- push 而非 replace，保留浏览器历史栈，用户可再次前进回到聊天
- 与项目中其他页面的导航模式一致（如 HomePage 中的 feature card 点击）

## Risks / Trade-offs

- [风险] 用户误触返回按钮导致离开当前对话 → 缓解：对话状态已由 sessions 保存，返回后可从首页重新进入继续
- [风险] 与侧边栏切换按钮位置相邻，可能混淆 → 缓解：使用不同图标（ArrowLeft vs ☰），按钮间有间距
