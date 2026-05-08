## 1. 添加返回按钮组件

- [x] 1.1 在 ChatPage.vue 的 script 中导入 `ArrowLeft` 图标和 `useRouter`
- [x] 1.2 在 `chat-header-left` 区域最前面添加返回按钮元素（el-button text 类型 + ArrowLeft 图标 + el-tooltip）

## 2. 实现导航逻辑

- [x] 2.1 创建 `goHome` 方法，调用 `router.push({ name: 'Home' })` 导航至首页
- [x] 2.2 将 `goHome` 方法绑定到返回按钮的 click 事件

## 3. 样式适配

- [x] 3.1 为返回按钮添加样式，确保与头部其他元素对齐并有适当间距
- [x] 3.2 添加移动端响应式样式，确保触控区域不小于 44x44px

## 4. 验证

- [x] 4.1 验证点击按钮可正确导航至首页，且浏览器历史栈正常
- [x] 4.2 验证在有活跃对话时返回，会话数据不丢失
- [x] 4.3 验证侧边栏折叠和展开状态下按钮均可见可用
