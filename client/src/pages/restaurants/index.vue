<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  Search,
  Star,
  StarFilled,
  Location,
  Warning,
  Money,
} from "@element-plus/icons-vue";
import { searchRestaurants } from "@/shared/api/restaurants";
import { useRestaurantStore } from "@/stores/restaurant";
import { useAuthStore } from "@/stores/auth";
import type {
  RestaurantListItem,
  SearchRestaurantsParams,
} from "@/shared/types/restaurant";

const router = useRouter();
const restaurantStore = useRestaurantStore();
const authStore = useAuthStore();

const keyword = ref("");
const selectedCity = ref("");
const selectedTags = ref<string[]>([]);
const selectedCuisine = ref<string[]>([]);
const selectedSort = ref<"comprehensive" | "rating" | "popularity">(
  "comprehensive",
);
const currentPage = ref(1);
const pageSize = 20;

const restaurants = ref<RestaurantListItem[]>([]);
const total = ref(0);
const totalPages = ref(0);
const loading = ref(false);
const hasSearched = ref(false);
const networkError = ref(false);

const availableTags = [
  "正餐",
  "小吃",
  "快餐",
  "咖啡",
  "茶饮",
  "甜品",
  "火锅",
  "烧烤",
  "休闲",
];
const availableCuisines = [
  "粤菜",
  "川菜",
  "湘菜",
  "湖北菜",
  "东北菜",
  "西餐",
  "日韩料理",
  "海鲜",
];
const sortOptions = [
  { label: "综合", value: "comprehensive" },
  { label: "评分", value: "rating" },
  { label: "热度", value: "popularity" },
];
const hotCities = ["武汉", "北京", "杭州", "成都", "厦门", "西安"];

async function handleSearch(resetPage = true) {
  if (resetPage) currentPage.value = 1;
  loading.value = true;
  networkError.value = false;
  hasSearched.value = true;

  const params: SearchRestaurantsParams = {
    ...(keyword.value.trim() && { keyword: keyword.value.trim() }),
    page: currentPage.value,
    pageSize,
    sort: selectedSort.value,
  };
  if (selectedCity.value) params.city = selectedCity.value;
  if (selectedTags.value.length > 0) params.tags = selectedTags.value;
  if (selectedCuisine.value.length > 0) params.cuisine = selectedCuisine.value;

  try {
    const { data } = await searchRestaurants(params);
    restaurants.value = data.items;
    total.value = data.total;
    totalPages.value = data.totalPages;

    data.items.forEach((item) => {
      if (item.isFavorited !== undefined) {
        restaurantStore.setFavoriteStatus(item.id, item.isFavorited);
      }
    });
  } catch {
    networkError.value = true;
    restaurants.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const queryKw = router.currentRoute.value.query.keyword;
  const queryCity = router.currentRoute.value.query.city;
  if (typeof queryKw === "string") keyword.value = queryKw;
  if (typeof queryCity === "string") selectedCity.value = queryCity;
  handleSearch();
});

watch([selectedTags, selectedCuisine, selectedSort, selectedCity], () => {
  handleSearch(true);
});

function handlePageChange(page: number) {
  currentPage.value = page;
  handleSearch(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleToggleFavorite(item: RestaurantListItem, event: Event) {
  event.stopPropagation();

  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }

  const currentStatus =
    restaurantStore.getFavoriteStatus(item.id) ?? item.isFavorited ?? false;
  const result = await restaurantStore.toggleFavorite(item.id, currentStatus);

  if (result.success) {
    item.isFavorited = result.isFavorited;
    ElMessage.success(result.isFavorited ? "已加入收藏" : "已取消收藏");
  } else {
    ElMessage.error("操作失败，请重试");
  }
}

function goToDetail(id: string) {
  router.push({ path: `/restaurants/${id}` });
}

function goToFavorites() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }
  router.push("/restaurants/favorites");
}

function pickCity(city: string) {
  selectedCity.value = selectedCity.value === city ? "" : city;
}

function isFavorited(item: RestaurantListItem): boolean {
  return (
    restaurantStore.getFavoriteStatus(item.id) ?? item.isFavorited ?? false
  );
}

const defaultImage =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzIwIDIwMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZWY3ZWQiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmRiYTc0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+NveaXoOWbvueJhzwvdGV4dD48L3N2Zz4=";
</script>

<template>
  <div class="tl-page restaurants-page">
    <!-- ── Hero ── -->
    <section class="search-hero">
      <div class="hero-text">
        <span class="hero-pill">美食探店</span>
        <h1>发现 <span class="tl-grad-text warm">舌尖上的好味道</span></h1>
        <p>按城市、菜系、人均价位多维度筛选，AI 帮你避雷选好店</p>
      </div>

      <div class="hero-search">
        <el-input
          v-model="keyword"
          placeholder="搜索餐厅、菜品或特色风味..."
          size="large"
          clearable
          @keydown.enter="handleSearch()"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" size="large" round @click="handleSearch()">
          搜索
        </el-button>
      </div>

      <div class="hero-actions">
        <el-button text type="primary" @click="goToFavorites">
          <el-icon><StarFilled /></el-icon>
          我的美食收藏
        </el-button>
      </div>
    </section>

    <!-- ── Filters ── -->
    <section class="filter-card">
      <div class="filter-row">
        <span class="filter-label">热门城市</span>
        <div class="chip-list">
          <button
            v-for="city in hotCities"
            :key="city"
            class="chip"
            :class="{ active: selectedCity === city }"
            @click="pickCity(city)"
          >
            {{ city }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">菜系</span>
        <div class="chip-list">
          <button
            v-for="c in availableCuisines"
            :key="c"
            class="chip cuisine"
            :class="{ active: selectedCuisine.includes(c) }"
            @click="
              selectedCuisine.includes(c)
                ? (selectedCuisine = selectedCuisine.filter((t) => t !== c))
                : selectedCuisine.push(c)
            "
          >
            {{ c }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">标签</span>
        <div class="chip-list">
          <button
            v-for="tag in availableTags"
            :key="tag"
            class="chip"
            :class="{ active: selectedTags.includes(tag) }"
            @click="
              selectedTags.includes(tag)
                ? (selectedTags = selectedTags.filter((t) => t !== tag))
                : selectedTags.push(tag)
            "
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">排序</span>
        <el-radio-group v-model="selectedSort" size="default">
          <el-radio-button
            v-for="opt in sortOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <span v-if="total > 0" class="result-count">共 {{ total }} 家餐厅</span>
      </div>
    </section>

    <!-- ── Loading ── -->
    <div v-if="loading" class="state-block">
      <div class="skel-grid">
        <el-skeleton v-for="i in 6" :key="i" animated>
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
    </div>

    <div v-else-if="networkError" class="state-block">
      <div class="state-card error">
        <el-icon :size="48"><Warning /></el-icon>
        <h3>加载失败</h3>
        <p>网络异常，请检查后重试</p>
        <el-button type="primary" round @click="handleSearch(false)">
          重新加载
        </el-button>
      </div>
    </div>

    <div v-else-if="hasSearched && restaurants.length === 0" class="state-block">
      <div class="state-card">
        <el-empty description="未找到匹配的餐厅">
          <p class="empty-tip">换个关键词或菜系试试</p>
        </el-empty>
      </div>
    </div>

    <!-- ── Grid ── -->
    <section v-else-if="restaurants.length > 0" class="card-grid">
      <article
        v-for="item in restaurants"
        :key="item.id"
        class="rest-card"
        @click="goToDetail(item.id)"
      >
        <div class="rest-cover">
          <img :src="item.thumbnail || defaultImage" :alt="item.name" />
          <button
            class="fav-btn"
            :class="{ active: isFavorited(item) }"
            @click="handleToggleFavorite(item, $event)"
          >
            <el-icon v-if="isFavorited(item)"><StarFilled /></el-icon>
            <el-icon v-else><Star /></el-icon>
          </button>
          <div v-if="item.score" class="score-badge">
            ★ {{ item.score.toFixed(1) }}
          </div>
          <div v-if="item.avgCost" class="cost-badge">
            <el-icon><Money /></el-icon>
            人均 ¥{{ item.avgCost }}
          </div>
        </div>

        <div class="rest-body">
          <h3 class="rest-name">{{ item.name }}</h3>
          <p class="rest-city">
            <el-icon><Location /></el-icon>{{ item.city }}
          </p>

          <div v-if="item.cuisine.length || item.tags.length" class="rest-tags">
            <el-tag
              v-for="c in item.cuisine.slice(0, 2)"
              :key="`cuisine-${c}`"
              size="small"
              type="warning"
              effect="light"
            >
              {{ c }}
            </el-tag>
            <el-tag
              v-for="t in item.tags.slice(0, 2)"
              :key="`tag-${t}`"
              size="small"
              effect="plain"
            >
              {{ t }}
            </el-tag>
          </div>

          <p v-if="item.address" class="rest-addr">{{ item.address }}</p>
        </div>
      </article>
    </section>

    <div v-if="!loading && totalPages > 1" class="pagination">
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
.restaurants-page {
  max-width: 1200px;
}

/* ── Hero ── */
.search-hero {
  background: linear-gradient(135deg, #fff7ed 0%, #fef2f2 60%, #fef3c7 100%);
  border-radius: var(--tl-radius-2xl);
  padding: 36px 36px 28px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}

.search-hero::before {
  content: "";
  position: absolute;
  top: -120px;
  right: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(251, 146, 60, 0.18) 0%,
    transparent 70%
  );
}

.hero-text {
  position: relative;
  margin-bottom: 22px;
}

.hero-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--tl-radius-pill);
  background: rgba(255, 255, 255, 0.75);
  color: #f97316;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.hero-text h1 {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 800;
  color: var(--tl-text-1);
  letter-spacing: -0.3px;
}

.tl-grad-text.warm {
  background: linear-gradient(90deg, #fb923c 0%, #f97316 50%, #ef4444 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-text p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 14px;
}

.hero-search {
  display: flex;
  gap: 12px;
  position: relative;
  margin-bottom: 12px;
}

.hero-search :deep(.el-input__wrapper) {
  border-radius: var(--tl-radius-pill);
  padding: 6px 18px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.hero-search .el-button {
  padding: 0 28px;
  height: 46px;
  font-weight: 600;
  background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
  border: none;
}

.hero-actions {
  display: flex;
  justify-content: flex-end;
  position: relative;
}

/* ── Filter card ── */
.filter-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  padding: 18px 22px;
  box-shadow: var(--tl-shadow-md);
  margin-bottom: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-label {
  font-size: 13px;
  color: var(--tl-text-3);
  font-weight: 500;
  min-width: 56px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 6px 14px;
  border-radius: var(--tl-radius-pill);
  background: var(--tl-bg-mute);
  color: var(--tl-text-3);
  font-size: 13px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--tl-tx);
}

.chip:hover {
  background: #ffedd5;
  color: #f97316;
}

.chip.active {
  background: #ffedd5;
  color: #f97316;
  border-color: #fed7aa;
  font-weight: 600;
}

.chip.cuisine.active {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

.result-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--tl-text-5);
}

/* ── Grid ── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.rest-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-lg);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--tl-border-soft);
  transition:
    transform var(--tl-tx),
    box-shadow var(--tl-tx);
}

.rest-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--tl-shadow-lg);
}

.rest-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--tl-bg-mute);
  overflow: hidden;
}

.rest-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.rest-card:hover .rest-cover img {
  transform: scale(1.06);
}

.fav-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tl-text-5);
  font-size: 17px;
  backdrop-filter: blur(6px);
  transition: all var(--tl-tx);
}

.fav-btn:hover {
  background: #fff;
  transform: scale(1.08);
}

.fav-btn.active {
  color: #f59e0b;
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

.cost-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--tl-radius-pill);
  background: rgba(249, 115, 22, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.rest-body {
  padding: 14px 16px 16px;
}

.rest-name {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--tl-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rest-city {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--tl-text-5);
}

.rest-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.rest-tags :deep(.el-tag) {
  border-radius: 6px;
}

.rest-addr {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tl-text-5);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.state-block {
  padding: 40px 0;
}

.skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.state-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  padding: 60px 40px;
  text-align: center;
  box-shadow: var(--tl-shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.state-card.error .el-icon {
  color: var(--tl-danger);
}

.state-card h3 {
  margin: 0;
  font-size: 18px;
  color: var(--tl-text-2);
}

.state-card p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 14px;
}

.empty-tip {
  margin-top: 4px;
  color: var(--tl-text-5);
  font-size: 13px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}

@media (max-width: 640px) {
  .search-hero {
    padding: 24px 20px 20px;
  }

  .hero-text h1 {
    font-size: 24px;
  }

  .hero-search {
    flex-direction: column;
  }

  .filter-card {
    padding: 14px 16px;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
