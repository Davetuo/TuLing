<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { Bell, Search, User, ArrowDown } from "@element-plus/icons-vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const searchKeyword = ref("");

const navItems = [
  { name: "首页", path: "/home" },
  { name: "智能问答", path: "/chat" },
  { name: "景点", path: "/spots" },
  { name: "美食", path: "/restaurants" },
  { name: "酒店", path: "/hotels" },
  { name: "评价", path: "/spots/reviews" },
  { name: "行程规划", path: "/trips" },
  { name: "图片纪念墙", path: "/albums" },
];

const isActive = (path: string) => {
  if (path === "/home") return route.path === "/" || route.path === "/home";
  return route.path === path || route.path.startsWith(path + "/");
};

const userInitial = computed(() => {
  const n = authStore.user?.nickname || "旅";
  return n.slice(0, 1).toUpperCase();
});

async function handleLogout() {
  await authStore.logout();
  router.push("/login");
}

function handleSearch() {
  const kw = searchKeyword.value.trim();
  if (!kw) return;
  router.push({ path: "/spots", query: { keyword: kw } });
}

function goLogin() {
  router.push("/login");
}

function handleNotifications() {
  ElMessage.info("暂无新消息");
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-inner">
        <router-link to="/home" class="header-left">
          <div class="logo-mark">T</div>
          <div class="logo-text">
            <h1>途灵</h1>
            <span class="subtitle">AI 智能旅行搭子</span>
          </div>
        </router-link>

        <nav class="header-nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ active: isActive(item.path) }"
          >
            {{ item.name }}
          </router-link>
        </nav>

        <div class="header-right">
          <div class="header-search">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索目的地/景点/攻略"
              clearable
              :prefix-icon="Search"
              @keydown.enter="handleSearch"
            />
          </div>

          <el-badge is-dot class="bell-badge">
            <el-button
              text
              circle
              :icon="Bell"
              class="bell-btn"
              @click="handleNotifications"
            />
          </el-badge>

          <el-dropdown v-if="authStore.isLoggedIn" trigger="click">
            <span class="user-chip">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-name">{{
                authStore.user?.nickname || "旅行者"
              }}</span>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/spots/favorites')">
                  景点收藏
                </el-dropdown-item>
                <el-dropdown-item @click="router.push('/restaurants/favorites')">
                  美食收藏
                </el-dropdown-item>
                <el-dropdown-item @click="router.push('/hotels/favorites')">
                  酒店收藏
                </el-dropdown-item>
                <el-dropdown-item divided @click="router.push('/trips')">
                  我的行程
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span v-else class="user-chip clickable" @click="goLogin">
            <el-icon class="user-arrow"><User /></el-icon>
            <span class="user-name">登录 / 注册</span>
            <el-icon class="user-arrow"><ArrowDown /></el-icon>
          </span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #f6f8fc;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}

.header-inner {
  max-width: 1440px;
  margin: 0 auto;
  height: 68px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 28px;
}

/* ── Logo ── */
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c83ff 0%, #5ab3ff 100%);
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(112, 124, 255, 0.35);
  font-family: "Segoe UI", system-ui, sans-serif;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.logo-text h1 {
  margin: 0;
  font-size: 19px;
  color: #1f2937;
  font-weight: 700;
}

.subtitle {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

/* ── Nav ── */
.header-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
}

.nav-link {
  position: relative;
  padding: 8px 14px;
  font-size: 14px;
  color: #475569;
  text-decoration: none;
  border-radius: 8px;
  transition: color 0.2s;
}

.nav-link:hover {
  color: #6366f1;
}

.nav-link.active {
  color: #6366f1;
  font-weight: 600;
}

.nav-link.active::after {
  content: "";
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, #7c83ff, #5ab3ff);
}

/* ── Right side ── */
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.header-search {
  width: 240px;
}

.header-search :deep(.el-input__wrapper) {
  border-radius: 999px;
  background: #f1f5f9;
  box-shadow: none;
  padding-left: 14px;
}

.header-search :deep(.el-input__wrapper:hover),
.header-search :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1px #c7d2fe inset;
}

.bell-badge :deep(.el-badge__content.is-dot) {
  top: 6px;
  right: 6px;
  background: #f56c6c;
}

.bell-btn {
  font-size: 18px;
  color: #475569;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  transition: background 0.2s;
  outline: none;
}

.user-chip:hover {
  background: #e2e8f0;
}

.user-chip.clickable {
  padding: 6px 12px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c83ff, #5ab3ff);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-name {
  font-size: 13px;
  color: #334155;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-arrow {
  color: #94a3b8;
  font-size: 12px;
}

.app-main {
  min-height: calc(100vh - 68px);
}

/* ── Responsive ── */
@media (max-width: 1180px) {
  .header-search {
    width: 180px;
  }
  .header-nav {
    gap: 2px;
  }
  .nav-link {
    padding: 8px 10px;
    font-size: 13px;
  }
}

@media (max-width: 960px) {
  .header-inner {
    padding: 0 16px;
    gap: 12px;
  }
  .header-nav {
    display: none;
  }
  .header-search {
    width: 160px;
  }
  .subtitle {
    display: none;
  }
}

@media (max-width: 600px) {
  .header-search {
    display: none;
  }
  .user-name {
    display: none;
  }
}
</style>
