## Context

当前项目使用 Vue Router 4，路由配置维护在 `client/src/router/index.ts` 中，采用手动数组方式定义所有路由。项目有 10 条路由、11 个页面组件、2 个布局组件。每次新增页面需要：
1. 在 `pages/` 目录下创建 `.vue` 文件
2. 在 `router/index.ts` 中手动添加路由配置
3. 设置正确的 `meta` 字段（`requiresAuth`/`requiresGuest`）
4. 确保 lazy import 路径正确

项目使用 Vite 6 + TypeScript 5.6 构建，Vue 3.5，已有 Element Plus UI 库。

## Goals / Non-Goals

**Goals:**
- 实现基于文件系统的自动路由生成，新增页面时零配置注册路由
- 提供 TypeScript 类型安全的路由名称和参数
- 通过声明式方式（`<route>` block）管理页面 meta 信息
- 实现 meta 驱动的布局自动选择系统，消除布局绑定的样板代码
- 保持现有的认证守卫逻辑不变
- 保持所有现有路由路径和页面功能完全兼容

**Non-Goals:**
- 不涉及后端路由变更
- 不改变认证逻辑本身（JWT、cookie 机制不变）
- 不引入 SSR/SSG 相关配置
- 不重写已有页面组件的内部逻辑
- 不涉及导航菜单 UI 重设计

## Decisions

### Decision 1: 选择 unplugin-vue-router 作为自动路由方案

**选择**: [unplugin-vue-router](https://github.com/posva/unplugin-vue-router)

**替代方案**:
- **vite-plugin-pages**: 较早的方案，但维护已转向 unplugin-vue-router
- **手动 `import.meta.glob` 方案**: 完全自定义，但需要自己实现类型生成和约定

**理由**:
- 由 Vue Router 作者 Eduardo (posva) 维护，与 Vue Router 4 深度集成
- 提供开箱即用的 TypeScript typed routes
- 支持 `<route>` SFC block 声明 meta
- 支持 Vite 插件生态，配置简单
- 社区活跃，文档完善

### Decision 2: 页面目录结构约定

**选择**: 保持 `src/pages/` 作为路由目录，按以下约定映射：

```
pages/
├── index.vue             → /         (重定向到 /home)
├── home.vue              → /home
├── chat.vue              → /chat
├── login.vue             → /login
├── register.vue          → /register
├── spots/
│   ├── index.vue         → /spots
│   ├── [id].vue          → /spots/:id
│   └── favorites.vue     → /spots/favorites
├── trips.vue             → /trips
└── albums.vue            → /albums
```

**理由**:
- 文件路径即路由路径，直觉性强
- 动态路由使用 `[param]` 约定（unplugin-vue-router 标准）
- 嵌套目录自动映射为嵌套路由路径
- 与现有 URL 结构完全兼容

### Decision 3: 布局系统实现方式

**选择**: Meta-driven 布局选择器组件

在 `App.vue` 中实现一个 `LayoutResolver` 组件，根据路由 meta 中的 `layout` 字段动态渲染对应布局：

```vue
<!-- App.vue -->
<template>
  <component :is="layoutComponent">
    <router-view />
  </component>
</template>
```

每个页面在 `<route>` block 中声明布局：
```vue
<route lang="yaml">
meta:
  layout: auth
  requiresGuest: true
</route>
```

**替代方案**:
- **嵌套路由 + 布局路由**: 需要在路由结构中引入额外的层级，增加复杂性
- **每个页面手动 import 布局**: 当前模式的变体，不够 DRY

**理由**:
- 布局选择完全由页面声明驱动，无需集中配置
- 默认布局为 `AppLayout`（大多数页面使用），仅少数页面需要显式声明
- 新增布局只需创建布局组件并在页面中引用名称

### Decision 4: 认证守卫保留方式

**选择**: 保留现有 `router.beforeEach` 全局守卫，仅移除路由数组

守卫逻辑不变，仍然读取 `route.meta.requiresAuth` 和 `route.meta.requiresGuest`。这些 meta 值由页面文件中的 `<route>` block 提供。

**理由**:
- 全局守卫是集中式的安全边界，不应分散
- meta 字段来源改变（从路由数组 → 页面文件声明）但逻辑一致
- 降低迁移风险

### Decision 5: 类型安全导航

**选择**: 启用 unplugin-vue-router 的 typed routes 功能

- 自动生成 `typed-router.d.ts`
- `router.push()` 调用获得 route name 自动补全和参数类型检查
- 编译时捕获无效路由引用

**理由**:
- 防止拼写错误导致的运行时导航失败
- 重命名/删除页面时 TypeScript 编译报错
- 零运行时成本

## Risks / Trade-offs

- **[迁移期间路由断裂]** → 分阶段迁移：先安装配置插件，再逐页面迁移文件结构，最后移除旧路由数组。每步验证所有路由可访问。
- **[文件命名约定学习曲线]** → 在项目 README 或 CLAUDE.md 中记录约定规则。约定本身简单直观。
- **[unplugin-vue-router 版本兼容]** → 锁定兼容当前 Vite 6 + Vue 3.5 的稳定版本，在 `package.json` 中使用精确版本号。
- **[`<route>` block IDE 支持]** → VSCode + Volar 已原生支持。需要确认团队 IDE 配置。
- **[动态路由参数类型]** → `[id]` 参数默认为 string，与现有 UUID 使用方式一致，无额外处理。
