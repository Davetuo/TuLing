## 1. 模板修改

- [x] 1.1 将 AppLayout.vue 中 header-left 区域的 `<h1>途灵</h1>` 用 `<router-link to="/home">` 包裹，使标题和副标题整体可点击导航至主页

## 2. 样式调整

- [x] 2.1 为 router-link 添加 scoped CSS 样式：重置 text-decoration 为 none、color 为 inherit，并设置 cursor: pointer，确保视觉与修改前一致

## 3. 验证

- [x] 3.1 在子页面（如 /chat）点击"途灵"标题，验证可正确导航至 /home
- [x] 3.2 在 /home 页面点击"途灵"标题，验证无重复导航或页面刷新
- [x] 3.3 验证标题视觉样式与修改前一致（字体大小、颜色、无下划线）
