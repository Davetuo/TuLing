# 途灵 (TuLing) 项目结构分析

## 登录模块 & 页面导航模块深度分析

**项目名称**: 途灵 - AI 智能旅行搭子  
**分析日期**: 2026-05-05  
**技术栈**: Vue 3 + Vite + TypeScript (Frontend) | NestJS + Fastify + Prisma (Backend)

---

## 📁 完整项目结构

### 前端结构
```
G:\TuLing\client\src\
├── pages/auth/
│   ├── LoginPage.vue
│   └── RegisterPage.vue
├── layouts/
│   ├── AppLayout.vue (应用布局)
│   └── AuthLayout.vue (认证布局)
├── stores/
│   └── auth.ts (Pinia 状态管理)
├── router/
│   └── index.ts (路由配置和导航守卫)
├── shared/
│   ├── api/
│   │   ├── client.ts (Axios + Token 刷新)
│   │   ├── auth.ts (认证 API)
│   │   ├── chat.ts
│   │   └── sse.ts
│   └── types/
│       ├── auth.ts
│       └── chat.ts
├── pages/
│   ├── home/HomePage.vue
│   ├── chat/ChatPage.vue
│   ├── spots/SpotListPage.vue
│   ├── trips/TripListPage.vue
│   └── albums/AlbumListPage.vue
└── App.vue
```

### 后端结构
```
G:\TuLing\server\src\
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── register.dto.ts
│       └── send-captcha.dto.ts
├── common/
│   ├── guards/jwt-auth.guard.ts
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   └── current-user.decorator.ts
│   └── filters/global-exception.filter.ts
├── user/
├── chat/
├── prisma/
├── redis/
└── app.module.ts
```

### E2E 测试
```
G:\TuLing\client\e2e\
├── auth-guard.spec.ts
├── chat-new-session.spec.ts
├── chat-advanced.spec.ts
├── chat-history-summary.spec.ts
├── chat-recommendations.spec.ts
└── helpers.ts
```

