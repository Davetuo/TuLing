## 1. 数据库与基础设施

- [x] 1.1 创建 scenic_spots 数据表 Prisma Schema（含 name, city, address, tags, score, open_time, images, introduction, transport, ticket_info, phone, suggested_duration, source 等字段）
- [x] 1.2 创建 spot_favorites 数据表 Prisma Schema（user_id, spot_id 复合主键，created_at）
- [x] 1.3 创建 spot_reviews 数据表 Prisma Schema（id, spot_id, user_id, score, content, images, status, created_at）
- [x] 1.4 编写并执行数据库迁移（prisma migrate），启用 pg_trgm 扩展
- [x] 1.5 创建数据库索引：name GIN(pg_trgm)、city B-tree、tags GIN、score B-tree
- [x] 1.6 编写景点种子数据脚本（50-100 条热门景点 + 部分评价数据）

## 2. 后端 SpotModule 基础结构

- [x] 2.1 创建 NestJS SpotModule（module, controller, service 文件结构）
- [x] 2.2 定义 DTO：SearchSpotsDto（keyword, city, tags, sort, page, pageSize 验证）
- [x] 2.3 定义 DTO：SpotDetailResponseDto、SpotListItemDto、PaginatedResponseDto
- [x] 2.4 定义 DTO：SpotReviewListDto（page, pageSize）
- [x] 2.5 注册 SpotModule 到 AppModule，配置路由前缀 /api/spots

## 3. 后端景点搜索 API

- [x] 3.1 实现 GET /api/spots 搜索接口（Service 层）：关键词 pg_trgm 模糊匹配 + 城市过滤 + 标签过滤 + 排序 + 分页
- [x] 3.2 实现搜索结果响应格式：包含 total, totalPages, currentPage, items 分页元数据
- [x] 3.3 添加空关键词校验，返回 400 错误
- [x] 3.4 集成 Redis 缓存热门搜索结果（TTL 10 分钟，key 为 query params hash）
- [x] 3.5 编写搜索接口单元测试

## 4. 后端景点详情 API

- [x] 4.1 实现 GET /api/spots/:id 详情接口：返回景点完整信息
- [x] 4.2 处理无效 spot ID 返回 404 响应
- [x] 4.3 集成 Redis 缓存景点详情（TTL 10 分钟）
- [x] 4.4 编写详情接口单元测试

## 5. 后端收藏 API

- [x] 5.1 实现 POST /api/spots/:id/favorite 收藏接口（需认证守卫）
- [x] 5.2 实现 DELETE /api/spots/:id/favorite 取消收藏接口（需认证守卫）
- [x] 5.3 实现 GET /api/spots/favorites 获取用户收藏列表接口（分页，按收藏时间倒序）
- [x] 5.4 在搜索结果中附带当前用户的收藏状态（已登录时）
- [x] 5.5 收藏/取消收藏时失效相关 Redis 缓存
- [x] 5.6 编写收藏接口单元测试

## 6. 后端评价 API

- [x] 6.1 实现 GET /api/spots/:id/reviews 评价列表接口（分页，每页 10 条，最新优先）
- [x] 6.2 实现评价摘要数据返回（综合评分、评价总数，嵌入详情接口响应）
- [x] 6.3 编写评价接口单元测试

## 7. 前端路由与页面结构

- [x] 7.1 在 Vue Router 中注册景点模块路由：/spots、/spots/:id、/spots/favorites
- [x] 7.2 创建前端 pages/spots/ 目录结构：SpotSearch.vue、SpotDetail.vue、SpotFavorites.vue
- [x] 7.3 创建 shared/api/spots.ts API 调用层（封装所有景点相关 HTTP 请求）

## 8. 前端景点搜索页

- [x] 8.1 实现搜索栏组件：关键词输入、城市选择、标签筛选、排序切换
- [x] 8.2 实现景点卡片列表组件（SpotCard）：展示名称、缩略图、城市、评分、标签、简介、收藏图标
- [x] 8.3 实现分页组件对接（Element Plus Pagination）
- [x] 8.4 实现空状态展示：无结果时显示推荐热门景点
- [x] 8.5 实现加载状态（骨架屏/loading 指示器）
- [x] 8.6 实现网络错误状态展示与重试按钮

## 9. 前端景点详情页

- [x] 9.1 实现图片轮播组件（Element Plus Carousel 或自定义）
- [x] 9.2 实现基础信息区块：地址、开放时间、建议游玩时长、门票、电话
- [x] 9.3 实现图文介绍区块（富文本渲染）
- [x] 9.4 实现交通提示区块
- [x] 9.5 实现评价摘要区块：综合评分 + 热门评价片段（最多 5 条）
- [x] 9.6 实现底部操作区：收藏按钮、加入行程（占位）、分享、返回
- [x] 9.7 实现详情页骨架屏加载状态
- [x] 9.8 实现 404 页面处理（无效景点 ID）
- [x] 9.9 实现网络错误状态与重试

## 10. 前端收藏功能

- [x] 10.1 实现收藏按钮组件（支持乐观更新 + 失败回滚）
- [x] 10.2 实现收藏列表页（SpotFavorites.vue）：复用 SpotCard 组件，按收藏时间排序
- [x] 10.3 实现收藏列表空状态展示
- [x] 10.4 实现未登录用户收藏时弹出登录引导弹窗
- [x] 10.5 实现 Pinia store 管理收藏状态，确保搜索页/详情页/收藏列表状态一致

## 11. 前端评价浏览

- [x] 11.1 实现评价片段组件（ReviewSnippet）：头像、昵称、评分星级、文字、图片缩略图、日期
- [x] 11.2 实现"查看全部评价"展开/跳转功能
- [x] 11.3 实现评价列表分页加载（加载更多模式）
- [x] 11.4 实现评价图片点击查看大图

## 12. 集成测试与验收

- [x] 12.1 端到端验证：搜索 → 列表 → 详情 → 收藏完整流程
- [x] 12.2 验证搜索性能目标（平均响应 <= 1 秒）
- [x] 12.3 验证未登录用户场景：搜索可用、收藏受限、登录引导正常
- [x] 12.4 验证空状态和错误状态所有分支
