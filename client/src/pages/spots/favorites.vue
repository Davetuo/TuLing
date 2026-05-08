<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, StarFilled, Location, Search } from '@element-plus/icons-vue'
import { getFavorites } from '@/shared/api/spots'
import { useSpotStore } from '@/stores/spot'
import type { SpotListItem } from '@/shared/types/spots'

const router = useRouter()
const spotStore = useSpotStore()

const favorites = ref<SpotListItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const loading = ref(true)
const pageSize = 20

// 默认图片
const defaultImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzIwIDIwMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmNWY3ZmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjYzBjNGNjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pqC5peg5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='

async function loadFavorites() {
  loading.value = true
  try {
    const { data } = await getFavorites(currentPage.value, pageSize)
    favorites.value = data.items
    total.value = data.total
    totalPages.value = data.totalPages
  } catch {
    ElMessage.error('加载收藏列表失败')
  } finally {
    loading.value = false
  }
}

async function handleUnfavorite(spot: SpotListItem, index: number) {
  const result = await spotStore.toggleFavorite(spot.id, true)
  if (result.success) {
    favorites.value.splice(index, 1)
    total.value--
    ElMessage.success('已取消收藏')
  } else {
    ElMessage.error('操作失败，请重试')
  }
}

function goToDetail(spotId: string) {
  router.push({ path: `/spots/${spotId}` })
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadFavorites()
}

onMounted(() => {
  loadFavorites()
})
</script>

<template>
  <div class="favorites-page">
    <div class="page-header">
      <h1 class="page-title">我的收藏</h1>
      <el-button type="primary" plain @click="router.push('/spots')">
        <el-icon><Search /></el-icon>
        探索景点
      </el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="4" animated />
      <el-skeleton :rows="4" animated style="margin-top: 20px" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="favorites.length === 0" class="empty-state">
      <el-empty description="暂无收藏">
        <el-button type="primary" @click="router.push('/spots')">
          去探索景点
        </el-button>
      </el-empty>
    </div>

    <!-- 收藏列表 -->
    <div v-else class="favorites-list">
      <TransitionGroup name="list">
        <div
          v-for="(spot, index) in favorites"
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
                :icon="StarFilled"
                type="warning"
                circle
                size="small"
                @click.stop="handleUnfavorite(spot, index)"
              />
            </div>
            <div class="spot-card__meta">
              <span class="spot-card__city">
                <el-icon><Location /></el-icon>
                {{ spot.city }}
              </span>
              <span v-if="spot.score" class="spot-card__score">
                <el-rate :model-value="spot.score" disabled show-score score-template="{value}" />
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
            <p v-if="spot.briefIntro" class="spot-card__intro">{{ spot.briefIntro }}</p>
          </div>
        </div>
      </TransitionGroup>

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
  </div>
</template>

<style scoped>
.favorites-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.loading-state,
.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.favorites-list {
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
  transition: box-shadow 0.2s, border-color 0.2s;
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

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

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
