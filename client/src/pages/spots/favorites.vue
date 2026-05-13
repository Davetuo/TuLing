<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { StarFilled, Location, Search } from "@element-plus/icons-vue";
import { getFavorites } from "@/shared/api/spots";
import { useSpotStore } from "@/stores/spot";
import type { SpotListItem } from "@/shared/types/spots";

const router = useRouter();
const spotStore = useSpotStore();

const favorites = ref<SpotListItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const totalPages = ref(0);
const loading = ref(true);
const pageSize = 20;

const defaultImage =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzIwIDIwMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmNWY3ZmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjYzBjNGNjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pqC5peg5Zu+54mHPC90ZXh0Pjwvc3ZnPg==";

async function loadFavorites() {
  loading.value = true;
  try {
    const { data } = await getFavorites(currentPage.value, pageSize);
    favorites.value = data.items;
    total.value = data.total;
    totalPages.value = data.totalPages;
  } catch {
    ElMessage.error("加载收藏列表失败");
  } finally {
    loading.value = false;
  }
}

async function handleUnfavorite(spot: SpotListItem, index: number) {
  const result = await spotStore.toggleFavorite(spot.id, true);
  if (result.success) {
    favorites.value.splice(index, 1);
    total.value--;
    ElMessage.success("已取消收藏");
  } else {
    ElMessage.error("操作失败，请重试");
  }
}

function goToDetail(spotId: string) {
  router.push({ path: `/spots/${spotId}` });
}

function handlePageChange(page: number) {
  currentPage.value = page;
  loadFavorites();
}

onMounted(() => {
  loadFavorites();
});
</script>

<template>
  <div class="tl-page favorites-page">
    <section class="fav-hero">
      <div class="hero-text">
        <span class="hero-pill">我的收藏</span>
        <h1>珍藏的 <span class="tl-grad-text">心动目的地</span></h1>
        <p>把心仪的景点收进来，随时回来翻看灵感</p>
      </div>
      <el-button type="primary" round @click="router.push('/spots')">
        <el-icon><Search /></el-icon>
        继续探索
      </el-button>
    </section>

    <section class="stats-bar">
      <div class="stat">
        <span class="stat-num">{{ total }}</span>
        <span class="stat-label">已收藏景点</span>
      </div>
      <div class="stat-divider" />
      <div class="stat">
        <span class="stat-num">∞</span>
        <span class="stat-label">灵感无限</span>
      </div>
    </section>

    <!-- ── Loading ── -->
    <div v-if="loading" class="skel-grid">
      <el-skeleton v-for="i in 4" :key="i" animated>
        <template #template>
          <el-skeleton-item
            variant="image"
            style="width: 100%; height: 180px; border-radius: 14px"
          />
          <div style="padding: 12px 4px">
            <el-skeleton-item variant="h3" style="width: 60%" />
            <el-skeleton-item variant="text" style="margin-top: 8px" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- ── Empty ── -->
    <div v-else-if="favorites.length === 0" class="empty-state">
      <div class="empty-icon">⭐</div>
      <h3>还没有任何收藏</h3>
      <p>去探索热门景点，把它们收进你的"心愿单"吧</p>
      <el-button type="primary" round @click="router.push('/spots')">
        去探索景点
      </el-button>
    </div>

    <!-- ── Grid ── -->
    <section v-else class="fav-grid">
      <TransitionGroup name="fav-list">
        <article
          v-for="(spot, index) in favorites"
          :key="spot.id"
          class="fav-card"
          @click="goToDetail(spot.id)"
        >
          <div class="fav-cover">
            <img :src="spot.thumbnail || defaultImage" :alt="spot.name" />
            <button
              class="fav-btn active"
              @click.stop="handleUnfavorite(spot, index)"
            >
              <el-icon><StarFilled /></el-icon>
            </button>
            <div v-if="spot.score" class="score-badge">
              ★ {{ spot.score.toFixed(1) }}
            </div>
          </div>
          <div class="fav-body">
            <h3>{{ spot.name }}</h3>
            <p class="fav-city">
              <el-icon><Location /></el-icon>{{ spot.city }}
            </p>
            <div v-if="spot.tags.length" class="fav-tags">
              <el-tag
                v-for="tag in spot.tags.slice(0, 3)"
                :key="tag"
                size="small"
                effect="plain"
              >
                {{ tag }}
              </el-tag>
            </div>
            <p v-if="spot.briefIntro" class="fav-intro">{{ spot.briefIntro }}</p>
          </div>
        </article>
      </TransitionGroup>
    </section>

    <div v-if="totalPages > 1" class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        background
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  max-width: 1200px;
}

/* ── Hero ── */
.fav-hero {
  background: linear-gradient(135deg, #fef3c7 0%, #fdf2f8 60%, #ede9fe 100%);
  border-radius: var(--tl-radius-2xl);
  padding: 32px 36px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  overflow: hidden;
}

.fav-hero::before {
  content: "⭐";
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 160px;
  opacity: 0.08;
  pointer-events: none;
}

.hero-text {
  position: relative;
}

.hero-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--tl-radius-pill);
  background: rgba(255, 255, 255, 0.7);
  color: var(--tl-warning);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.hero-text h1 {
  margin: 0 0 8px;
  font-size: 30px;
  font-weight: 800;
  color: var(--tl-text-1);
}

.hero-text p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 14px;
}

/* ── Stats ── */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 16px 24px;
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  box-shadow: var(--tl-shadow-md);
  margin-bottom: 22px;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--tl-text-1);
}

.stat-label {
  font-size: 12px;
  color: var(--tl-text-5);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--tl-border);
}

/* ── Empty ── */
.empty-state {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-2xl);
  padding: 64px 32px;
  text-align: center;
  box-shadow: var(--tl-shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 4px;
}

.empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: var(--tl-text-2);
}

.empty-state p {
  margin: 0 0 8px;
  color: var(--tl-text-4);
  font-size: 14px;
}

/* ── Grid ── */
.skel-grid,
.fav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.fav-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-lg);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--tl-border-soft);
  transition:
    transform var(--tl-tx),
    box-shadow var(--tl-tx);
}

.fav-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--tl-shadow-lg);
}

.fav-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--tl-bg-mute);
  overflow: hidden;
}

.fav-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.fav-card:hover .fav-cover img {
  transform: scale(1.06);
}

.fav-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: #f59e0b;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  transition: all var(--tl-tx);
}

.fav-btn:hover {
  background: #fff;
  transform: scale(1.08);
}

.score-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: var(--tl-radius-pill);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.fav-body {
  padding: 14px 16px 16px;
}

.fav-body h3 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--tl-text-1);
}

.fav-city {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--tl-text-5);
}

.fav-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.fav-tags :deep(.el-tag) {
  border-radius: 6px;
  background: var(--tl-bg-soft);
  border-color: var(--tl-border-soft);
  color: var(--tl-text-3);
}

.fav-intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--tl-text-4);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ── List transitions ── */
.fav-list-enter-active,
.fav-list-leave-active {
  transition: all 0.3s ease;
}

.fav-list-enter-from,
.fav-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .fav-hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 22px;
  }

  .hero-text h1 {
    font-size: 22px;
  }

  .fav-grid {
    grid-template-columns: 1fr;
  }
}
</style>
