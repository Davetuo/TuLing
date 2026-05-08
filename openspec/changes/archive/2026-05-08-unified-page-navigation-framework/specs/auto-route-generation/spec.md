## ADDED Requirements

### Requirement: 基于文件系统的路由自动生成
系统 SHALL 使用 `unplugin-vue-router` 插件，根据 `src/pages/` 目录结构自动生成 Vue Router 路由配置。开发者新增页面时只需在 `pages/` 目录下创建 `.vue` 文件，无需手动修改路由配置文件。

#### Scenario: 新增页面自动注册路由
- **WHEN** 开发者在 `src/pages/` 目录下创建新的 `.vue` 文件（如 `pages/settings.vue`）
- **THEN** 系统自动生成对应路由 `/settings`，无需修改 `router/index.ts`

#### Scenario: 嵌套目录映射嵌套路由
- **WHEN** 开发者在 `src/pages/spots/` 目录下创建 `favorites.vue`
- **THEN** 系统自动生成路由 `/spots/favorites`

#### Scenario: 动态路由参数
- **WHEN** 开发者创建文件名包含方括号的页面文件（如 `pages/spots/[id].vue`）
- **THEN** 系统自动生成动态路由 `/spots/:id`，参数 `id` 可通过 `route.params.id` 访问

### Requirement: 路由 meta 声明式配置
每个页面组件 SHALL 支持通过 `<route>` SFC block 声明路由 meta 信息，包括认证要求和布局选择。

#### Scenario: 声明需要认证的页面
- **WHEN** 页面文件包含 `<route lang="yaml">` block 并设置 `meta.requiresAuth: true`
- **THEN** 未登录用户访问该页面时被重定向至登录页

#### Scenario: 声明仅游客可访问的页面
- **WHEN** 页面文件包含 `<route>` block 并设置 `meta.requiresGuest: true`
- **THEN** 已登录用户访问该页面时被重定向至首页

#### Scenario: 未声明 meta 的页面
- **WHEN** 页面文件未包含 `<route>` block
- **THEN** 页面使用默认配置（requiresAuth: true, layout: app）

### Requirement: TypeScript 类型安全路由
系统 SHALL 自动生成 typed routes 类型定义文件，为所有路由名称和参数提供 TypeScript 类型检查。

#### Scenario: 路由名称类型检查
- **WHEN** 开发者在代码中使用 `router.push({ name: 'InvalidRoute' })` 引用不存在的路由
- **THEN** TypeScript 编译时报错，提示路由名称无效

#### Scenario: 动态路由参数类型检查
- **WHEN** 开发者使用 `router.push({ name: '/spots/[id]', params: {} })` 但未提供必需的 `id` 参数
- **THEN** TypeScript 编译时报错，提示缺少必需参数

### Requirement: 现有路由路径兼容
迁移到文件系统路由后，所有现有 URL 路径 MUST 保持不变，确保无断裂式变更。

#### Scenario: 主页路径保持不变
- **WHEN** 用户访问 `/home`
- **THEN** 系统正确渲染首页组件

#### Scenario: 景点详情路径保持不变
- **WHEN** 用户访问 `/spots/some-uuid`
- **THEN** 系统正确渲染景点详情组件，`route.params.id` 为 `some-uuid`

#### Scenario: 根路径重定向保持不变
- **WHEN** 用户访问 `/`
- **THEN** 系统重定向至 `/home`

#### Scenario: 收藏页路径保持不变
- **WHEN** 用户访问 `/spots/favorites`
- **THEN** 系统正确渲染收藏页面，不与动态路由 `/spots/:id` 冲突

### Requirement: Vite 插件集成
系统 SHALL 在 Vite 配置中集成 `unplugin-vue-router` 插件，并在开发模式下支持热更新路由生成。

#### Scenario: 开发模式热更新
- **WHEN** 开发者在开发服务器运行时新增或删除页面文件
- **THEN** 路由配置自动更新，无需重启开发服务器

#### Scenario: 生产构建包含所有路由
- **WHEN** 执行 `npm run build` 构建生产版本
- **THEN** 构建产物包含所有页面路由配置，应用正常运行
