## MODIFIED Requirements

### Requirement: 功能卡片导航
点击任意功能入口卡片 SHALL 使用 typed route 名称跳转至对应功能模块页面，导航调用 MUST 通过 TypeScript 编译时类型检查。

#### Scenario: 点击智能问答卡片
- **WHEN** 用户点击"智能问答"卡片
- **THEN** 系统使用 typed route 跳转至 `/chat` 路由页面

#### Scenario: 点击景点探索卡片
- **WHEN** 用户点击"景点探索"卡片
- **THEN** 系统使用 typed route 跳转至 `/spots` 路由页面

#### Scenario: 点击行程规划卡片
- **WHEN** 用户点击"行程规划"卡片
- **THEN** 系统使用 typed route 跳转至 `/trips` 路由页面

#### Scenario: 点击图片纪念墙卡片
- **WHEN** 用户点击"图片纪念墙"卡片
- **THEN** 系统使用 typed route 跳转至 `/albums` 路由页面

#### Scenario: 使用无效路由名称导航
- **WHEN** 开发者在功能卡片配置中使用不存在的 route 名称
- **THEN** TypeScript 编译时报错，阻止构建
