# Q&A Interface Structure Analysis

## 1. Q&A Page Component

**File:** `/g/TuLing/client/src/pages/chat/ChatPage.vue`
**Route Name:** Chat
**Route Path:** `/chat`

### Layout Structure
- **Sidebar (280px):** Session list, new chat button
- **Main Area:** Header + Messages + Input area
- **Responsive:** Sidebar collapses on mobile

### Key Components
- Sidebar with session history
- Welcome area with recommendation cards
- Message display with streaming support
- Input textarea with send button
- Summary section
- Typing indicator during streaming

## 2. Home Page

**File:** `/g/TuLing/client/src/pages/home/HomePage.vue`
**Route Name:** Home
**Route Path:** `/home`

### Components
- Hero section with welcome
- Feature cards (5 features):
  - 智能问答 (Chat) → routes to Chat
  - 景点探索 (Spots)
  - 景点评价 (Ratings)
  - 行程规划 (Trips)
  - 图片纪念墙 (Albums)
- Shortcuts section (hot destinations, recent trips, recent chats)

## 3. Router Configuration

**File:** `/g/TuLing/client/src/router/index.ts`

### Routes
```
/login          → Login (guest only)
/register       → Register (guest only)
/               → redirects to /home
/home           → Home (auth required)
/chat           → Chat/Q&A (auth required)
/spots          → Spots (auth required)
/trips          → Trips (auth required)
/albums         → Albums (auth required)
```

### Auth Guard
- Checks if route requires auth (meta.requiresAuth)
- Checks if route requires guest (meta.requiresGuest)
- Redirects unauthenticated users to login
- Restores auth state on app load

## 4. Navigation Patterns

### From Home Page
- Feature cards: `router.push({ name: 'Chat' })`, `router.push({ name: 'Spots' })` etc.
- Destination tags: `router.push({ name: 'Spots', query: { city } })`
- Buttons: Direct route navigation

### From Chat Page
- Internal: Session selection within sidebar
- No explicit back button
- Users must use browser back or click header

### From Other Pages
- SpotListPage, TripListPage, AlbumListPage all have:
  `<el-button @click="router.push({ name: 'Home' })">返回首页</el-button>`

## 5. Layout Hierarchy

```
App.vue
└── router-view (displays current page)
    └── AppLayout.vue (wrapper for all authenticated pages)
        ├── app-header (60px, contains "途灵" brand + logout)
        └── app-main (content area)
            └── Page Content (ChatPage, HomePage, etc.)
```

## 6. Back Navigation

### Current Implementation
- No back button in ChatPage
- Placeholder pages have explicit "返回首页" button
- Browser back button works via Vue Router history

### Missing
- Global back button in header
- Breadcrumb navigation
- Direct home link in header

## Key Files

| File | Purpose |
|------|---------|
| `/client/src/router/index.ts` | Route definitions & guards |
| `/client/src/pages/chat/ChatPage.vue` | Q&A interface |
| `/client/src/pages/home/HomePage.vue` | Home dashboard |
| `/client/src/layouts/AppLayout.vue` | Main layout wrapper |
| `/client/src/App.vue` | Root component |
| `/client/src/stores/auth.ts` | Auth state (Pinia) |
| `/client/src/shared/api/chat.ts` | Chat API client |
