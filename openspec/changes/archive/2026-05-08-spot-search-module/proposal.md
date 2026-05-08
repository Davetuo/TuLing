## Why

途灵产品 V1.0 核心功能之一是景点检索模块，帮助用户通过关键词快速查找景点、浏览详情、收藏目标，并为行程规划提供输入。当前系统已完成首页、聊天、认证等模块，景点检索作为 P0 优先级功能需要尽快实现，以补全核心用户旅行决策链路。

## What Changes

- 新增景点关键词搜索功能：支持按名称/城市/标签/排序方式检索景点
- 新增景点列表展示：分页展示匹配结果，包含名称、缩略图、城市、评分、标签、简介、收藏状态
- 新增景点详情页：展示景点完整信息，包括图片轮播、基本信息、图文介绍、交通提示、评价摘要
- 新增景点收藏功能：用户可收藏/取消收藏景点，收藏列表可管理
- 新增景点评价浏览（只读）：展示景点的综合评分和热门评价片段
- 新增后端 SpotModule：提供景点搜索、详情、收藏、评价的 API 接口
- 新增数据库表：scenic_spots、spot_favorites、spot_reviews
- 新增 ProviderModule 景点数据源适配层接口

## Capabilities

### New Capabilities

- `spot-search`: 景点关键词搜索功能，包含输入校验、分页查询、排序、标签过滤、空结果处理
- `spot-detail`: 景点详情页展示，包括图片轮播、基础信息、图文介绍、交通提示、评价摘要、操作区
- `spot-favorite`: 景点收藏/取消收藏功能，包含登录校验、状态同步、收藏列表管理
- `spot-review-read`: 景点评价浏览（只读），包含综合评分展示和热门评价片段列表

### Modified Capabilities

（无需修改现有 spec，景点检索为全新独立模块）

## Impact

- **后端代码**：新增 SpotModule（Controller、Service、DTO）、扩展 ProviderModule 增加景点数据源适配器
- **前端代码**：新增 `src/pages/spots/` 目录，包含搜索页、详情页、收藏管理相关组件
- **数据库**：新增 scenic_spots、spot_favorites、spot_reviews 三张表及对应索引（B-tree、GIN、pg_trgm）
- **API 接口**：新增 `/api/spots/search`、`/api/spots/:id`、`/api/spots/:id/favorite`、`/api/spots/:id/reviews` 等端点
- **依赖**：需集成 PostgreSQL pg_trgm 扩展；Redis 用于热门景点缓存
- **路由**：前端新增 `/spots`（搜索页）、`/spots/:id`（详情页）路由
