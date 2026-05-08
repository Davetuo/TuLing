## ADDED Requirements

### Requirement: Meta 驱动布局自动选择
系统 SHALL 根据当前路由的 `meta.layout` 字段自动选择并渲染对应的布局组件。页面无需手动导入或包裹布局组件。

#### Scenario: 默认使用 AppLayout
- **WHEN** 页面未在 `<route>` block 中指定 `meta.layout`
- **THEN** 系统自动使用 `AppLayout` 作为该页面的布局

#### Scenario: 指定 AuthLayout
- **WHEN** 页面在 `<route>` block 中设置 `meta.layout: auth`
- **THEN** 系统自动使用 `AuthLayout` 作为该页面的布局

#### Scenario: 路由切换时布局切换
- **WHEN** 用户从使用 `AuthLayout` 的登录页导航到使用 `AppLayout` 的首页
- **THEN** 布局组件正确切换，页面正常渲染

### Requirement: 布局组件注册机制
系统 SHALL 维护一个布局名称到布局组件的映射关系，支持通过字符串标识符引用布局。

#### Scenario: 布局映射关系
- **WHEN** 应用启动时
- **THEN** 布局系统包含以下默认映射：`app` → `AppLayout`，`auth` → `AuthLayout`

#### Scenario: 新增布局组件
- **WHEN** 开发者在 `layouts/` 目录新增布局组件并注册到布局映射
- **THEN** 页面可以通过 `meta.layout` 字段引用新布局名称

### Requirement: App.vue 作为布局解析入口
`App.vue` SHALL 作为布局解析器，读取当前路由 meta 并动态渲染对应布局组件，布局组件内包含 `<router-view>`。

#### Scenario: App.vue 渲染结构
- **WHEN** 应用渲染任意页面
- **THEN** 渲染结构为 `App.vue → LayoutComponent → PageComponent`

#### Scenario: 无效布局名称降级
- **WHEN** 页面指定了一个不存在的 `meta.layout` 值
- **THEN** 系统降级使用默认布局 `AppLayout` 并在控制台输出警告
