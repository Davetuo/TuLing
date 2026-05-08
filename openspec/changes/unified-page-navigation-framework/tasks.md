## 1. 安装与配置

- [x] 1.1 安装 `unplugin-vue-router` 依赖到 client 项目
- [x] 1.2 在 `vite.config.ts` 中配置 VueRouter 插件，设置 `routesFolder` 为 `src/pages`
- [x] 1.3 创建 `typed-router.d.ts` 类型声明文件，配置 TypeScript 识别自动生成的路由类型
- [x] 1.4 更新 `tsconfig.json` 的 `include` 字段，包含自动生成的类型文件

## 2. 页面文件重构

- [x] 2.1 重命名 `pages/home/HomePage.vue` 为 `pages/home.vue`，映射路由 `/home`
- [x] 2.2 重命名 `pages/chat/ChatPage.vue` 为 `pages/chat.vue`，映射路由 `/chat`
- [x] 2.3 重命名 `pages/trips/TripListPage.vue` 为 `pages/trips.vue`，映射路由 `/trips`
- [x] 2.4 重命名 `pages/albums/AlbumListPage.vue` 为 `pages/albums.vue`，映射路由 `/albums`
- [x] 2.5 重命名 `pages/auth/LoginPage.vue` 为 `pages/login.vue`，映射路由 `/login`
- [x] 2.6 重命名 `pages/auth/RegisterPage.vue` 为 `pages/register.vue`，映射路由 `/register`
- [x] 2.7 重构 spots 目录：`SpotSearch.vue` → `pages/spots/index.vue`（路由 `/spots`）
- [x] 2.8 重构 spots 目录：`SpotDetail.vue` → `pages/spots/[id].vue`（路由 `/spots/:id`）
- [x] 2.9 重构 spots 目录：`SpotFavorites.vue` → `pages/spots/favorites.vue`（路由 `/spots/favorites`）
- [x] 2.10 创建 `pages/index.vue` 或配置根路径 `/` 重定向到 `/home`

## 3. 页面 Meta 声明

- [x] 3.1 为所有需要认证的页面添加 `<route lang="yaml">` block，声明 `meta.requiresAuth: true`
- [x] 3.2 为 `login.vue` 和 `register.vue` 添加 `<route>` block，声明 `meta.requiresGuest: true` 和 `meta.layout: auth`
- [x] 3.3 确认默认 meta 策略：未声明 `<route>` block 的页面默认 `requiresAuth: true`，`layout: app`

## 4. 布局系统实现

- [x] 4.1 创建布局映射模块 `src/layouts/index.ts`，导出布局名称到组件的映射对象
- [x] 4.2 重构 `App.vue`，实现 LayoutResolver 逻辑：读取 `route.meta.layout`，动态渲染对应布局组件
- [x] 4.3 处理无效布局名称的降级逻辑：使用 AppLayout 并输出控制台警告
- [x] 4.4 确保布局切换时的过渡效果正常（从 AuthLayout 到 AppLayout）

## 5. 路由入口重构

- [x] 5.1 重构 `router/index.ts`：移除手动路由数组，改用 `unplugin-vue-router` 自动生成的 routes
- [x] 5.2 保留 `router.beforeEach` 认证守卫逻辑，确保读取页面声明的 meta 字段
- [x] 5.3 配置根路径 `/` 重定向到 `/home`（通过 `extendRoutes` 或 `pages/index.vue`）

## 6. 导航代码迁移

- [x] 6.1 更新 `HomePage.vue` 中的功能卡片导航，使用 typed route 名称替代字符串
- [x] 6.2 更新其他页面中的 `router.push()` 调用，确保使用 typed route 兼容写法
- [x] 6.3 验证所有 `router-link` 的 `to` 属性与新路由名称/路径兼容

## 7. 验证与清理

- [x] 7.1 验证所有现有路由路径可正常访问（`/home`, `/chat`, `/spots`, `/spots/:id`, `/spots/favorites`, `/trips`, `/albums`, `/login`, `/register`）
- [x] 7.2 验证认证守卫正常工作：未登录访问受保护页面重定向到 `/login`
- [x] 7.3 验证 TypeScript 编译通过，无类型错误
- [x] 7.4 删除不再需要的旧页面文件和空目录
- [x] 7.5 执行 `npm run build` 确认生产构建成功
