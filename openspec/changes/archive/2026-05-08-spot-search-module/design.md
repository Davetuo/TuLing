## Context

途灵是一个 AI 智能旅行搭子产品，当前已完成认证、首页、智能问答等基础模块。景点检索是 V1.0 五大核心功能之一，需为用户提供关键词搜索、详情浏览、收藏管理和评价查看能力。

技术栈已确定：前端 Vue 3 + TypeScript + Element Plus，后端 NestJS + Prisma + PostgreSQL + Redis。架构采用模块化单体模式。

当前无景点相关数据表和接口，需从零构建完整的前后端模块。

## Goals / Non-Goals

**Goals:**

- 实现完整的景点关键词搜索（名称、城市、标签、排序、分页）
- 景点详情展示（图片轮播、基础信息、介绍、交通、评价摘要）
- 收藏/取消收藏景点，登录状态校验
- 评价只读浏览（综合评分 + 热门评价列表）
- 搜索平均响应时间 <= 1 秒
- 前后端完整实现，可独立部署运行

**Non-Goals:**

- 不实现评价发布功能（V1.1 计划）
- 不实现 AI 避坑指南（P1 功能，不阻塞 V1.0）
- 不集成 Elasticsearch/Meilisearch（MVP 阶段 PostgreSQL 足够）
- 不实现基于地理位置的附近搜索（经纬度排序）
- 不实现景点数据爬取/同步系统（使用预置种子数据 + 预留 Provider 接口）

## Decisions

### 1. 搜索引擎选择：PostgreSQL + pg_trgm

**决定**：使用 PostgreSQL 内置能力实现搜索，不引入外部搜索引擎。

**原因**：
- MVP 阶段景点数据量预估 < 10 万条，PostgreSQL B-tree + GIN + pg_trgm 足以满足 <= 1 秒响应目标
- 减少基础设施复杂度和运维成本
- 技术选择文档已明确"当数据达百万级再升级"

**替代方案**：
- Elasticsearch：功能强大但部署复杂，MVP 阶段过重
- Meilisearch：轻量但增加额外服务依赖

### 2. 缓存策略：Redis 热门数据缓存

**决定**：热门搜索结果和景点详情使用 Redis 缓存，TTL 为 10 分钟。

**原因**：
- 热门景点被高频访问，缓存可显著降低数据库压力
- 10 分钟 TTL 平衡了数据新鲜度和性能

**缓存 Key 设计**：
- 搜索结果：`spot:search:{hash(query_params)}`
- 景点详情：`spot:detail:{spotId}`
- 用户收藏列表：`spot:favorites:{userId}`（写时失效）

### 3. API 设计风格：RESTful

**决定**：景点模块 API 采用标准 RESTful 风格。

**端点设计**：
- `GET /api/spots` - 搜索景点（query params: keyword, city, tags, sort, page, pageSize）
- `GET /api/spots/:id` - 获取景点详情
- `POST /api/spots/:id/favorite` - 收藏景点
- `DELETE /api/spots/:id/favorite` - 取消收藏
- `GET /api/spots/:id/reviews` - 获取景点评价列表
- `GET /api/spots/favorites` - 获取当前用户收藏列表

### 4. 数据库索引策略

**决定**：采用多层索引优化搜索性能。

- `scenic_spots.name`：GIN 索引 + pg_trgm（模糊搜索）
- `scenic_spots.city`：B-tree 索引（精确/前缀匹配）
- `scenic_spots.tags`：GIN 索引（数组包含查询）
- `scenic_spots.score`：B-tree 索引（排序）
- `spot_favorites`：复合主键 (user_id, spot_id)

### 5. 前端页面结构

**决定**：景点模块包含两个主页面 + 收藏列表作为子视图。

- `/spots` - 搜索页（搜索栏 + 结果列表 + 分页）
- `/spots/:id` - 详情页（多区块布局）
- `/spots/favorites` - 我的收藏（复用列表组件）

### 6. 收藏操作的乐观更新

**决定**：前端收藏操作使用乐观更新模式。

**原因**：
- 提升用户体验，点击即时反馈
- 失败时回滚状态并提示用户

### 7. 分页策略：偏移量分页

**决定**：使用 offset + limit 分页方式，每页 20 条。

**原因**：
- 景点搜索场景用户习惯页码翻页
- 数据量 < 10 万条时偏移量分页性能可接受
- 实现简单，前端分页组件可直接对接

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| pg_trgm 在大数据量下性能退化 | 监控慢查询；预留 Provider 接口，可升级为 Elasticsearch |
| 景点数据质量不一致（来源多样） | 展示"数据更新时间"字段；预留用户纠错入口 |
| 缓存与数据库不一致 | 收藏操作写时失效缓存；详情页缓存 TTL 不超过 10 分钟 |
| 无景点种子数据导致功能无法体验 | 编写种子数据脚本，预置 50-100 条热门景点数据 |
| 收藏操作乐观更新失败 | 失败时回滚 UI 状态，toast 提示用户重试 |
| Redis 不可用时系统降级 | 缓存层 fallback 直接查数据库，不阻塞业务 |
