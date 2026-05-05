# Q&A Interface Navigation Structure

## Quick Summary

**Q&A Component:** `/client/src/pages/chat/ChatPage.vue`  
**Q&A Route:** `/chat` (name: `Chat`)  
**Home Component:** `/client/src/pages/home/HomePage.vue`  
**Home Route:** `/home` (name: `Home`)  
**Router Config:** `/client/src/router/index.ts`  

---

## File Locations

| Component | File Path |
|-----------|-----------|
| Q&A Page | /client/src/pages/chat/ChatPage.vue |
| Home Page | /client/src/pages/home/HomePage.vue |
| Spots Page | /client/src/pages/spots/SpotListPage.vue |
| Trips Page | /client/src/pages/trips/TripListPage.vue |
| Albums Page | /client/src/pages/albums/AlbumListPage.vue |
| Router Config | /client/src/router/index.ts |
| Main Layout | /client/src/layouts/AppLayout.vue |
| Root Component | /client/src/App.vue |

---

## Routes

```
/login               → LoginPage (guest only)
/register            → RegisterPage (guest only)
/                    → redirects to /home
/home                → HomePage (auth required)
/chat                → ChatPage (auth required) [Q&A]
/spots               → SpotListPage (auth required)
/trips               → TripListPage (auth required)
/albums              → AlbumListPage (auth required)
```

---

## Q&A Page Structure

Location: `/client/src/pages/chat/ChatPage.vue`

### Layout
- **Sidebar (280px)**: Session list, new chat button
- **Main (flex)**: Header + messages + input
- **Header (60px)**: Title, summary button
- **Responsive**: Sidebar collapses on mobile

### Key Features
1. Session management in sidebar
2. Message streaming (SSE)
3. Welcome + recommendations
4. Smart summary generation
5. Input with 2000 char limit
6. Typing indicator
7. No back button to home

### State
- sessions, currentSessionId, messages
- isStreaming, streamingContent, inputText
- showSummary, summaryContent
- recommendations, sidebarCollapsed
- Various loading flags

### Methods
- loadSessions()
- handleNewChat()
- selectSession(id)
- handleSend() 
- handleStopStream()
- handleSummary()
- loadRecommendations()
- toggleSidebar()

### API Calls
- GET /api/chat/sessions
- GET /api/chat/sessions/:id
- POST /api/chat/messages (SSE)
- POST /api/chat/sessions/:id/summary (SSE)
- GET /api/chat/recommendations

---

## Home Page Structure

Location: `/client/src/pages/home/HomePage.vue`

### Components
1. **Hero Section**: Welcome + subtitle
2. **Feature Cards** (6 items):
   - 智能问答 → Chat
   - 景点探索 → Spots
   - 景点评价 → Spots
   - 行程规划 → Trips
   - 图片纪念墙 → Albums

3. **Shortcuts**:
   - Hot destinations (city tags)
   - Recent trips (button)
   - Recent conversations (button)

### Navigation Functions
```javascript
goFeature(routeName)           // Feature cards
goHotDestination(city)         // City tags
router.push({ name: 'Trips' }) // Button
router.push({ name: 'Chat' })  // Button
```

---

## Router Configuration

File: `/client/src/router/index.ts`

### Auth Guard
```javascript
beforeEach((to, from, next) => {
  if (!authStore.isLoggedIn) {
    await authStore.fetchUser()
  }
  
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.requiresGuest && authStore.isLoggedIn) {
    next('/home')
  } else {
    next()
  }
})
```

### Meta Flags
- `requiresAuth: true` - Protected route
- `requiresGuest: true` - Public route only

---

## Layout Stack

```
App.vue
  router-view
    AppLayout.vue (wrapper for auth routes)
      header (60px)
        brand "途灵"
        user info
        logout button
      main
        slot (page content)
```

---

## Navigation Methods

### Route Names
```javascript
router.push({ name: 'Chat' })
router.push({ name: 'Home' })
router.push({ name: 'Spots' })
router.push({ name: 'Trips' })
router.push({ name: 'Albums' })
```

### With Query Parameters
```javascript
router.push({ name: 'Spots', query: { city: 'Beijing' } })
```

### By Path
```javascript
router.push('/chat')
router.push('/home')
```

### Browser History
```javascript
router.back()
```

---

## Back Navigation

### Current Implementation
- **ChatPage**: No back button (use browser back)
- **Placeholder Pages**: "返回首页" button
- **HomePage**: No back needed

### Missing Features
- No back button in ChatPage header
- Header brand not clickable
- No global navigation menu
- No breadcrumbs

---

## Recommendations

### 1. Add Back Button to ChatPage
Add to chat-header-left:
```vue
<el-button text @click="router.push({ name: 'Home' })">
  ← 返回
</el-button>
```

### 2. Make Header Brand Clickable
Modify AppLayout.vue:
```vue
<div @click="router.push({ name: 'Home' })" 
     style="cursor: pointer;">
  途灵
</div>
```

### 3. Global Navigation Menu
Add to AppLayout header:
```vue
<nav>
  <el-button @click="router.push({ name: 'Home' })">首页</el-button>
  <el-button @click="router.push({ name: 'Chat' })">问答</el-button>
</nav>
```

---

## Key Technologies

- **Frontend**: Vue 3 + TypeScript
- **Router**: Vue Router 4
- **State**: Pinia (auth store)
- **UI**: Element Plus
- **Build**: Vite
- **Streaming**: SSE (Server-Sent Events)

