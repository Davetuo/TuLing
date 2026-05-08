## ADDED Requirements

### Requirement: Hot destinations display
首页 SHALL 在快捷入口区展示热门目的地推荐，至少包含 4 个热门城市或景点入口。

#### Scenario: Hot destinations render
- **WHEN** 已登录用户访问首页且数据加载完成
- **THEN** 快捷入口区展示热门目的地标签或卡片（如北京、杭州、成都、厦门）

#### Scenario: Click hot destination
- **WHEN** 用户点击某个热门目的地
- **THEN** 系统跳转至景点探索页 `/spots`，并传递目的地城市作为查询参数

### Requirement: Recent trips shortcut
首页 SHALL 在快捷入口区提供最近行程的快捷入口。

#### Scenario: Recent trips available
- **WHEN** 用户有已保存的行程记录且数据加载成功
- **THEN** 展示最近 1-3 条行程摘要（目的地 + 日期），点击可跳转至行程详情

#### Scenario: No recent trips
- **WHEN** 用户没有已保存的行程记录
- **THEN** 展示空状态文案"暂无行程"，并提供"开始规划"引导入口

### Requirement: Recent conversations shortcut
首页 SHALL 在快捷入口区提供最近 AI 对话的快捷入口。

#### Scenario: Recent conversations available
- **WHEN** 用户有历史 AI 对话记录且数据加载成功
- **THEN** 展示最近 1-3 条对话摘要（标题 + 时间），点击可跳转至对应对话

#### Scenario: No recent conversations
- **WHEN** 用户没有历史 AI 对话记录
- **THEN** 展示空状态文案"暂无对话"，并提供"开始提问"引导入口

### Requirement: Shortcut area async loading
快捷入口区数据 MUST 异步加载，不阻塞首页首屏渲染。

#### Scenario: Shortcuts load after cards
- **WHEN** 首页首次渲染
- **THEN** 功能入口卡片先展示，快捷入口区数据异步加载并展示加载状态

### Requirement: Shortcut area failure fallback
快捷入口区数据加载失败时 SHALL 降级展示，不影响首页其他区域。

#### Scenario: API fails for recent trips
- **WHEN** 最近行程 API 请求失败
- **THEN** 最近行程区域展示"暂时无法加载最近行程"，其他区域正常展示
