<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Search, Star, StarFilled, Location } from "@element-plus/icons-vue";
import { searchSpots } from "@/shared/api/spots";
import { useSpotStore } from "@/stores/spot";
import { useAuthStore } from "@/stores/auth";
import type { SpotListItem, SearchSpotsParams } from "@/shared/types/spots";

const router = useRouter();
const spotStore = useSpotStore();
const authStore = useAuthStore();

// 搜索状态
const keyword = ref("");
const selectedCity = ref("");
const selectedTags = ref<string[]>([]);
const selectedSort = ref<"comprehensive" | "rating" | "popularity">(
  "comprehensive",
);
const currentPage = ref(1);
const pageSize = 20;

// 列表数据
const spots = ref<SpotListItem[]>([]);
const total = ref(0);
const totalPages = ref(0);
const loading = ref(false);
const hasSearched = ref(false);
const networkError = ref(false);

// 可用标签
const availableTags = [
  "亲子",
  "情侣",
  "小众",
  "免费",
  "夜景",
  "文化",
  "自然",
  "美食",
];
const sortOptions = [
  { label: "综合", value: "comprehensive" },
  { label: "评分", value: "rating" },
  { label: "热度", value: "popularity" },
];

// 搜索
async function handleSearch(resetPage = true) {
  if (resetPage) currentPage.value = 1;
  loading.value = true;
  networkError.value = false;
  hasSearched.value = true;

  const params: SearchSpotsParams = {
    ...(keyword.value.trim() && { keyword: keyword.value.trim() }),
    page: currentPage.value,
    pageSize,
    sort: selectedSort.value,
  };
  if (selectedCity.value) params.city = selectedCity.value;
  if (selectedTags.value.length > 0) params.tags = selectedTags.value;

  try {
    const { data } = await searchSpots(params);
    spots.value = data.items;
    total.value = data.total;
    totalPages.value = data.totalPages;

    // 同步收藏状态到 store
    data.items.forEach((item) => {
      if (item.isFavorited !== undefined) {
        spotStore.setFavoriteStatus(item.id, item.isFavorited);
      }
    });
  } catch (error) {
    networkError.value = true;
    spots.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

// 页面加载时自动获取所有景点
onMounted(() => {
  handleSearch();
});

// 分页
function handlePageChange(page: number) {
  currentPage.value = page;
  handleSearch(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 收藏切换
async function handleToggleFavorite(spot: SpotListItem, event: Event) {
  event.stopPropagation();

  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }

  const currentStatus =
    spotStore.getFavoriteStatus(spot.id) ?? spot.isFavorited ?? false;
  const result = await spotStore.toggleFavorite(spot.id, currentStatus);

  if (result.success) {
    spot.isFavorited = result.isFavorited;
    ElMessage.success(result.isFavorited ? "收藏成功" : "已取消收藏");
  } else {
    ElMessage.error("操作失败，请重试");
  }
}

// 跳转详情
function goToDetail(spotId: string) {
  router.push({ path: `/spots/${spotId}` });
}

// 跳转收藏列表
function goToFavorites() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }
  router.push("/spots/favorites");
}

// 键盘回车搜索
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") handleSearch();
}

// 获取收藏状态
function isFavorited(spot: SpotListItem): boolean {
  return spotStore.getFavoriteStatus(spot.id) ?? spot.isFavorited ?? false;
}

// 默认图片
const defaultImage =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzIwIDIwMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmNWY3ZmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjYzBjNGNjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pqC5peg5Zu+54mHPC90ZXh0Pjwvc3ZnPg==";
</script>

<template>
  <div class="spot-search-page">
    <!-- 搜索栏 -->
    <div class="search-header">
      <div class="page-header">
        <h1 class="page-title">景点探索</h1>
        <el-button type="primary" plain @click="goToFavorites">
          <el-icon><StarFilled /></el-icon>
          我的收藏
        </el-button>
      </div>
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="搜索景点名称、城市或特色..."
          size="large"
          clearable
          @keydown="handleKeydown"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button type="primary" @click="handleSearch()">搜索</el-button>
          </template>
        </el-input>
      </div>

      <!-- 筛选条件 -->
      <div class="filters">
        <div class="filter-row">
          <span class="filter-label">标签：</span>
          <el-check-tag
            v-for="tag in availableTags"
            :key="tag"
            :checked="selectedTags.includes(tag)"
            @change="
              (checked: boolean) => {
                if (checked) selectedTags.push(tag);
                else selectedTags = selectedTags.filter((t) => t !== tag);
              }
            "
          >
            {{ tag }}
          </el-check-tag>
        </div>
        <div class="filter-row">
          <span class="filter-label">排序：</span>
          <el-radio-group v-model="selectedSort" size="small">
            <el-radio-button
              v-for="opt in sortOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="4" animated />
      <el-skeleton :rows="4" animated style="margin-top: 20px" />
      <el-skeleton :rows="4" animated style="margin-top: 20px" />
    </div>

    <!-- 网络错误 -->
    <div v-else-if="networkError" class="error-state">
      <el-icon :size="48" color="#f56c6c"><Warning /></el-icon>
      <p>网络异常，请重试</p>
      <el-button type="primary" @click="handleSearch(false)">重试</el-button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="hasSearched && spots.length === 0" class="empty-state">
      <el-empty description="未找到匹配的景点">
        <template #default>
          <p>换个关键词试试，或探索热门目的地</p>
        </template>
      </el-empty>
    </div>

    <!-- 搜索结果列表 -->
    <div v-else-if="spots.length > 0" class="spot-list">
      <div
        v-for="spot in spots"
        :key="spot.id"
        class="spot-card"
        @click="goToDetail(spot.id)"
      >
        <div class="spot-card__image">
          <img :src="spot.thumbnail || defaultImage" :alt="spot.name" />
        </div>
        <div class="spot-card__content">
          <div class="spot-card__header">
            <h3 class="spot-card__name">{{ spot.name }}</h3>
            <el-button
              class="spot-card__fav"
              :icon="isFavorited(spot) ? StarFilled : Star"
              :type="isFavorited(spot) ? 'warning' : 'default'"
              circle
              size="small"
              @click="handleToggleFavorite(spot, $event)"
            />
          </div>
          <div class="spot-card__meta">
            <span class="spot-card__city">
              <el-icon><Location /></el-icon>
              {{ spot.city }}
            </span>
            <span v-if="spot.score" class="spot-card__score">
              <el-rate
                :model-value="spot.score"
                disabled
                show-score
                score-template="{value}"
              />
            </span>
          </div>
          <div v-if="spot.tags.length" class="spot-card__tags">
            <el-tag
              v-for="tag in spot.tags.slice(0, 4)"
              :key="tag"
              size="small"
              type="info"
              effect="plain"
            >
              {{ tag }}
            </el-tag>
          </div>
          <p v-if="spot.briefIntro" class="spot-card__intro">
            {{ spot.briefIntro }}
          </p>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 初始提示 -->
    <div v-else class="initial-state">
      <el-icon :size="64" color="#67c23a"><Search /></el-icon>
      <h2>发现心仪的目的地</h2>
      <p>搜索景点名称、城市或特色标签，开始你的旅行探索</p>
    </div>
  </div>
</template>

<script lang="ts">
import { Warning } from "@element-plus/icons-vue";
export default { components: { Warning } };
</script>

<style scoped>
.spot-search-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.search-header {
  margin-bottom: 24px;
}

.search-bar {
  margin-bottom: 16px;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
  min-width: 44px;
}

/* 列表 */
.spot-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spot-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}

.spot-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #d9ecff;
}

.spot-card__image {
  flex-shrink: 0;
  width: 160px;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
}

.spot-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spot-card__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spot-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.spot-card__name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-card__meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #909399;
}

.spot-card__city {
  display: flex;
  align-items: center;
  gap: 4px;
}

.spot-card__score :deep(.el-rate) {
  height: 20px;
}

.spot-card__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.spot-card__intro {
  font-size: 13px;
  color: #606266;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

/* 状态页面 */
.loading-state,
.error-state,
.empty-state,
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 12px;
  text-align: center;
}

.initial-state h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.initial-state p,
.error-state p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .spot-card {
    flex-direction: column;
  }

  .spot-card__image {
    width: 100%;
    height: 180px;
  }
}
</style>
