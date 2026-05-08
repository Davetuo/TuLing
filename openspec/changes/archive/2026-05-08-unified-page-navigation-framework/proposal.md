## Why

每次新增页面时，开发者需要在 `router/index.ts` 手动添加路由配置、设置 `meta` 字段、绑定布局组件，并在各页面中手动编写 `router.push()` 导航逻辑。这导致路由配置与页面组件之间缺乏统一约定，容易遗漏配置步骤，增加维护成本。需要引入基于文件系统约定的自动化路由框架，让新增页面只需创建文件即可自动注册路由和导航。

## What Changes

- 引入 **unplugin-vue-router**（基于文件系统的自动路由生成），替代手动维护的路由数组
- 建立 `pages/` 目录结构与路由路径的自动映射约定（文件名即路由）
- 通过 route block（`<route>` SFC 标签）在页面文件中声明 `meta` 信息（auth、layout 等）
- 重构 `AppLayout` 和 `AuthLayout` 的绑定方式，使用 meta-driven 布局选择器自动应用布局
- 保留现有的 `beforeEach` 导航守卫逻辑，但改为读取自动生成的 typed routes
- 提供 typed route names，让 `router.push()` 调用获得类型安全和自动补全
- 新增页面时只需在 `pages/` 目录下创建 `.vue` 文件并声明 `<route>` block，无需修改任何路由配置文件

## Capabilities

### New Capabilities
- `auto-route-generation`: 基于文件系统的自动路由生成，pages 目录结构自动映射为路由配置
- `layout-system`: Meta 驱动的布局选择系统，通过页面声明自动应用对应布局组件

### Modified Capabilities
- `home-feature-navigation`: 导航方式从手动 route name 字符串改为 typed route，确保类型安全

## Impact

- **前端代码**: `client/src/router/index.ts` 将被大幅简化，路由数组移除；所有页面文件可能需要重命名以匹配文件系统路由约定
- **页面目录结构**: `client/src/pages/` 目录结构需要重新组织，文件命名需遵循 unplugin-vue-router 的约定（如 `index.vue`、`[id].vue`）
- **依赖**: 新增 `unplugin-vue-router` 开发依赖
- **构建配置**: `vite.config.ts` 需要添加插件配置
- **TypeScript**: 新增自动生成的路由类型文件（`typed-router.d.ts`）
- **现有导航逻辑**: 各页面中 `router.push({ name: 'XXX' })` 将获得类型检查，无功能性变化
