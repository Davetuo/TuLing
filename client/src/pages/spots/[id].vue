<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Star, StarFilled, Location, Clock, Ticket, Phone,
  ArrowLeft, Share, Plus, Picture,
} from '@element-plus/icons-vue'
import { getSpotDetail, getSpotReviews } from '@/shared/api/spots'
import { useSpotStore } from '@/stores/spot'
import { useAuthStore } from '@/stores/auth'
import type { SpotDetail, SpotReview } from '@/shared/types/spots'

const route = useRoute()
const router = useRouter()
const spotStore = useSpotStore()
const authStore = useAuthStore()

const spotId = (route.params as { id: string }).id

// 状态
const spot = ref<SpotDetail | null>(null)
const loading = ref(true)
const networkError = ref(false)
const notFound = ref(false)

// 评价相关
const reviews = ref<SpotReview[]>([])
const reviewPage = ref(1)
const reviewTotal = ref(0)
const reviewLoading = ref(false)
const showAllReviews = ref(false)

// 图片预览
const previewVisible = ref(false)
const previewIndex = ref(0)

// 默认图片
const defaultImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmNWY3ZmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSIjYzBjNGNjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5pqC5peg5Zu+54mHPC90ZXh0Pjwvc3ZnPg=='

// 收藏状态
const isFavorited = computed(() => {
  if (!spot.value) return false
  return spotStore.getFavoriteStatus(spotId) ?? spot.value.isFavorited ?? false
})

// 加载详情
async function loadDetail() {
  loading.value = true
  networkError.value = false
  notFound.value = false

  try {
    const { data } = await getSpotDetail(spotId)
    spot.value = data
    if (data.isFavorited !== undefined) {
      spotStore.setFavoriteStatus(spotId, data.isFavorited)
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      notFound.value = true
    } else {
      networkError.value = true
    }
  } finally {
    loading.value = false
  }
}

// 加载评价
async function loadReviews() {
  reviewLoading.value = true
  try {
    const { data } = await getSpotReviews(spotId, reviewPage.value, 10)
    if (reviewPage.value === 1) {
      reviews.value = data.items
    } else {
      reviews.value.push(...data.items)
    }
    reviewTotal.value = data.total
  } catch {
    // silent fail
  } finally {
    reviewLoading.value = false
  }
}

// 加载更多评价
function loadMoreReviews() {
  reviewPage.value++
  loadReviews()
}

// 收藏
async function handleFavorite() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }

  const currentStatus = isFavorited.value
  const result = await spotStore.toggleFavorite(spotId, currentStatus)
  if (result.success) {
    ElMessage.success(result.isFavorited ? '收藏成功' : '已取消收藏')
  } else {
    ElMessage.error('操作失败，请重试')
  }
}

// 分享
function handleShare() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href)
    ElMessage.success('链接已复制到剪贴板')
  }
}

// 返回
function goBack() {
  router.back()
}

// 格式化日期
function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  loadDetail()
  loadReviews()
})
</script>

<template>
  <div class="spot-detail-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton style="width: 100%">
        <template #template>
          <el-skeleton-item variant="image" style="width: 100%; height: 300px" />
          <div style="padding: 16px">
            <el-skeleton-item variant="h1" style="width: 50%" />
            <el-skeleton-item variant="text" style="margin-top: 12px" />
            <el-skeleton-item variant="text" style="margin-top: 8px; width: 80%" />
            <el-skeleton-item variant="text" style="margin-top: 8px; width: 60%" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- 404 -->
    <div v-else-if="notFound" class="error-state">
      <el-empty description="景点不存在">
        <el-button type="primary" @click="router.push('/spots')">返回搜索</el-button>
      </el-empty>
    </div>

    <!-- 网络错误 -->
    <div v-else-if="networkError" class="error-state">
      <el-empty description="加载失败，请重试">
        <el-button type="primary" @click="loadDetail()">重试</el-button>
      </el-empty>
    </div>

    <!-- 详情内容 -->
    <template v-else-if="spot">
      <!-- 图片轮播 -->
      <div class="image-section">
        <el-carousel
          v-if="spot.images.length > 0"
          :height="'320px'"
          :autoplay="false"
          indicator-position="outside"
        >
          <el-carousel-item v-for="(img, idx) in spot.images" :key="idx">
            <img :src="img" :alt="`${spot.name} 图片 ${idx + 1}`" class="carousel-image" />
          </el-carousel-item>
        </el-carousel>
        <div v-else class="placeholder-image">
          <img :src="defaultImage" alt="暂无图片" />
        </div>
      </div>

      <!-- 标题区 -->
      <div class="detail-header">
        <h1 class="spot-name">{{ spot.name }}</h1>
        <div class="spot-meta">
          <el-rate
            v-if="spot.score"
            :model-value="spot.score"
            disabled
            show-score
            score-template="{value}"
          />
          <div v-if="spot.tags.length" class="spot-tags">
            <el-tag v-for="tag in spot.tags" :key="tag" size="small" type="info" effect="plain">
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="info-section">
        <h2 class="section-title">基本信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <el-icon><Location /></el-icon>
            <span>{{ spot.address || spot.city }}</span>
          </div>
          <div v-if="spot.openTime" class="info-item">
            <el-icon><Clock /></el-icon>
            <span>{{ spot.openTime }}</span>
          </div>
          <div v-if="spot.suggestedDuration" class="info-item">
            <el-icon><Clock /></el-icon>
            <span>建议游玩：{{ spot.suggestedDuration }}</span>
          </div>
          <div v-if="spot.ticketInfo" class="info-item">
            <el-icon><Ticket /></el-icon>
            <span>{{ spot.ticketInfo }}</span>
          </div>
          <div v-if="spot.phone" class="info-item">
            <el-icon><Phone /></el-icon>
            <span>{{ spot.phone }}</span>
          </div>
        </div>
      </div>

      <!-- 图文介绍 -->
      <div v-if="spot.introduction" class="intro-section">
        <h2 class="section-title">景点介绍</h2>
        <p class="intro-text">{{ spot.introduction }}</p>
      </div>

      <!-- 交通提示 -->
      <div v-if="spot.transport" class="transport-section">
        <h2 class="section-title">交通提示</h2>
        <p class="transport-text">{{ spot.transport }}</p>
      </div>

      <!-- 评价摘要 -->
      <div class="review-section">
        <h2 class="section-title">
          游客评价
          <span v-if="spot.reviewSummary.totalReviews > 0" class="review-count">
            ({{ spot.reviewSummary.totalReviews }}条)
          </span>
        </h2>

        <div v-if="spot.reviewSummary.totalReviews > 0" class="review-summary">
          <div class="review-score">
            <span class="score-number">{{ spot.reviewSummary.averageScore }}</span>
            <el-rate :model-value="spot.reviewSummary.averageScore || 0" disabled />
          </div>
        </div>

        <!-- 热门评价片段 -->
        <div v-if="spot.reviewSummary.topReviews.length > 0" class="review-snippets">
          <div
            v-for="review in spot.reviewSummary.topReviews"
            :key="review.id"
            class="review-item"
          >
            <div class="review-item__header">
              <el-avatar :size="32" :src="review.user.avatarUrl || undefined">
                {{ review.user.nickname?.charAt(0) }}
              </el-avatar>
              <span class="review-item__name">{{ review.user.nickname }}</span>
              <el-rate :model-value="review.score" disabled size="small" />
              <span class="review-item__date">{{ formatDate(review.createdAt) }}</span>
            </div>
            <p v-if="review.content" class="review-item__content">{{ review.content }}</p>
            <div v-if="review.images.length > 0" class="review-item__images">
              <img
                v-for="(img, idx) in review.images"
                :key="idx"
                :src="img"
                alt="评价图片"
                class="review-thumb"
              />
            </div>
          </div>
        </div>

        <div v-else class="no-reviews">
          <p>暂无评价</p>
        </div>

        <!-- 查看全部评价 -->
        <div v-if="spot.reviewSummary.totalReviews > 5" class="view-all-reviews">
          <el-button
            v-if="!showAllReviews"
            type="primary"
            link
            @click="showAllReviews = true"
          >
            查看全部评价 ({{ spot.reviewSummary.totalReviews }}条)
          </el-button>

          <!-- 全部评价列表 -->
          <div v-if="showAllReviews" class="full-reviews">
            <div
              v-for="review in reviews"
              :key="review.id"
              class="review-item"
            >
              <div class="review-item__header">
                <el-avatar :size="32" :src="review.user.avatarUrl || undefined">
                  {{ review.user.nickname?.charAt(0) }}
                </el-avatar>
                <span class="review-item__name">{{ review.user.nickname }}</span>
                <el-rate :model-value="review.score" disabled size="small" />
                <span class="review-item__date">{{ formatDate(review.createdAt) }}</span>
              </div>
              <p v-if="review.content" class="review-item__content">{{ review.content }}</p>
              <div v-if="review.images.length > 0" class="review-item__images">
                <img
                  v-for="(img, idx) in review.images"
                  :key="idx"
                  :src="img"
                  alt="评价图片"
                  class="review-thumb"
                />
              </div>
            </div>

            <div v-if="reviews.length < reviewTotal" class="load-more">
              <el-button :loading="reviewLoading" @click="loadMoreReviews">
                加载更多
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="action-bar">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-button
          :type="isFavorited ? 'warning' : 'default'"
          @click="handleFavorite"
        >
          <el-icon>
            <StarFilled v-if="isFavorited" />
            <Star v-else />
          </el-icon>
          {{ isFavorited ? '已收藏' : '收藏' }}
        </el-button>
        <el-button disabled>
          <el-icon><Plus /></el-icon>
          加入行程
        </el-button>
        <el-button @click="handleShare">
          <el-icon><Share /></el-icon>
          分享
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.spot-detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px 80px;
}

.loading-state,
.error-state {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 图片轮播 */
.image-section {
  margin: 0 -16px;
}

.carousel-image {
  width: 100%;
  height: 320px;
  object-fit: cover;
}

.placeholder-image img {
  width: 100%;
  height: 240px;
  object-fit: cover;
}

/* 标题区 */
.detail-header {
  padding: 20px 0 16px;
}

.spot-name {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 12px;
}

.spot-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.spot-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 区块通用 */
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.review-count {
  font-size: 14px;
  font-weight: 400;
  color: #909399;
}

/* 基本信息 */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.info-item .el-icon {
  margin-top: 2px;
  color: #909399;
}

/* 介绍 */
.intro-text,
.transport-text {
  font-size: 14px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-line;
  margin: 0;
}

/* 评价 */
.review-summary {
  margin-bottom: 16px;
}

.review-score {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-number {
  font-size: 32px;
  font-weight: 700;
  color: #f7ba2a;
}

.review-snippets,
.full-reviews {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-item {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.review-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.review-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.review-item__date {
  margin-left: auto;
  font-size: 12px;
  color: #c0c4cc;
}

.review-item__content {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  margin: 0;
}

.review-item__images {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.review-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.no-reviews {
  text-align: center;
  padding: 24px;
  color: #909399;
}

.view-all-reviews {
  margin-top: 12px;
  text-align: center;
}

.load-more {
  text-align: center;
  margin-top: 16px;
}

/* 底部操作区 */
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

@media (max-width: 640px) {
  .carousel-image {
    height: 220px;
  }

  .action-bar {
    gap: 8px;
    padding: 10px 12px;
  }

  .action-bar .el-button {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>
