<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  Star,
  StarFilled,
  Location,
  Clock,
  Phone,
  Money,
  ArrowLeft,
  Share,
} from "@element-plus/icons-vue";
import {
  getRestaurantDetail,
  getRestaurantReviews,
  createRestaurantReview,
} from "@/shared/api/restaurants";
import { useRestaurantStore } from "@/stores/restaurant";
import { useAuthStore } from "@/stores/auth";
import type {
  RestaurantDetail,
  RestaurantReview,
} from "@/shared/types/restaurant";

const route = useRoute();
const router = useRouter();
const restaurantStore = useRestaurantStore();
const authStore = useAuthStore();

const restaurantId = (route.params as { id: string }).id;

const detail = ref<RestaurantDetail | null>(null);
const loading = ref(true);
const networkError = ref(false);
const notFound = ref(false);

const reviews = ref<RestaurantReview[]>([]);
const reviewPage = ref(1);
const reviewTotal = ref(0);
const reviewLoading = ref(false);
const showAllReviews = ref(false);

const reviewForm = ref({ score: 5, content: "" });
const submittingReview = ref(false);

const defaultImage =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmZWY3ZWQiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSIjZmRiYTc0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+NveaXoOWbvueJhzwvdGV4dD48L3N2Zz4=";

const isFavorited = computed(() => {
  if (!detail.value) return false;
  return (
    restaurantStore.getFavoriteStatus(restaurantId) ??
    detail.value.isFavorited ??
    false
  );
});

async function loadDetail() {
  loading.value = true;
  networkError.value = false;
  notFound.value = false;

  try {
    const { data } = await getRestaurantDetail(restaurantId);
    detail.value = data;
    if (data.isFavorited !== undefined) {
      restaurantStore.setFavoriteStatus(restaurantId, data.isFavorited);
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      notFound.value = true;
    } else {
      networkError.value = true;
    }
  } finally {
    loading.value = false;
  }
}

async function loadReviews() {
  reviewLoading.value = true;
  try {
    const { data } = await getRestaurantReviews(
      restaurantId,
      reviewPage.value,
      10,
    );
    if (reviewPage.value === 1) {
      reviews.value = data.items;
    } else {
      reviews.value.push(...data.items);
    }
    reviewTotal.value = data.total;
  } catch {
    // silent
  } finally {
    reviewLoading.value = false;
  }
}

function loadMoreReviews() {
  reviewPage.value++;
  loadReviews();
}

async function submitReview() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }
  if (!reviewForm.value.score) {
    ElMessage.warning("请选择评分");
    return;
  }
  if (reviewForm.value.content.length > 500) {
    ElMessage.warning("评论内容不能超过500字");
    return;
  }

  submittingReview.value = true;
  try {
    await createRestaurantReview(restaurantId, {
      score: reviewForm.value.score,
      content: reviewForm.value.content.trim() || undefined,
    });
    ElMessage.success("评价提交成功");
    reviewForm.value = { score: 5, content: "" };
    reviewPage.value = 1;
    await Promise.all([loadDetail(), loadReviews()]);
    showAllReviews.value = true;
  } catch (error: any) {
    const msg = error?.response?.data?.message || "评价提交失败，请稍后重试";
    ElMessage.error(msg);
  } finally {
    submittingReview.value = false;
  }
}

async function handleFavorite() {
  if (!authStore.isLoggedIn) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }

  const currentStatus = isFavorited.value;
  const result = await restaurantStore.toggleFavorite(
    restaurantId,
    currentStatus,
  );
  if (result.success) {
    ElMessage.success(result.isFavorited ? "已加入收藏" : "已取消收藏");
  } else {
    ElMessage.error("操作失败，请重试");
  }
}

function handleShare() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href);
    ElMessage.success("链接已复制到剪贴板");
  }
}

function goBack() {
  router.back();
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

onMounted(() => {
  loadDetail();
  loadReviews();
});
</script>

<template>
  <div class="tl-page detail-page">
    <div v-if="loading" class="detail-skel">
      <el-skeleton-item
        variant="image"
        style="width: 100%; height: 360px; border-radius: 20px"
      />
      <div style="padding: 20px 4px">
        <el-skeleton-item variant="h1" style="width: 40%" />
        <el-skeleton-item variant="text" style="margin-top: 16px" />
        <el-skeleton-item variant="text" style="margin-top: 8px; width: 80%" />
      </div>
    </div>

    <div v-else-if="notFound" class="state-card">
      <el-empty description="餐厅不存在">
        <el-button type="primary" round @click="router.push('/restaurants')">
          返回搜索
        </el-button>
      </el-empty>
    </div>

    <div v-else-if="networkError" class="state-card">
      <el-empty description="加载失败，请重试">
        <el-button type="primary" round @click="loadDetail()">重试</el-button>
      </el-empty>
    </div>

    <template v-else-if="detail">
      <div class="topbar">
        <el-button text class="back-btn" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>

      <!-- ── Hero ── -->
      <section class="hero-section">
        <el-carousel
          v-if="detail.images.length > 0"
          height="380px"
          :autoplay="false"
          indicator-position="outside"
          arrow="hover"
        >
          <el-carousel-item
            v-for="(img, idx) in detail.images"
            :key="idx"
          >
            <div class="hero-slide" :style="{ '--bg-url': `url(${img})` }">
              <img
                :src="img"
                :alt="`${detail.name} 图片 ${idx + 1}`"
                class="hero-img"
              />
            </div>
          </el-carousel-item>
        </el-carousel>
        <div v-else class="hero-placeholder">
          <img :src="defaultImage" alt="暂无图片" />
        </div>

        <div v-if="detail.score" class="hero-rating">
          <div class="hero-rating-score">{{ detail.score.toFixed(1) }}</div>
          <el-rate :model-value="detail.score" disabled />
          <span class="hero-rating-meta">
            {{ detail.reviewSummary.totalReviews }} 条评价
          </span>
        </div>
      </section>

      <!-- ── Title ── -->
      <section class="title-section">
        <div class="title-main">
          <h1>{{ detail.name }}</h1>
          <p class="title-location">
            <el-icon><Location /></el-icon>
            {{ detail.address || detail.city }}
          </p>
          <div
            v-if="detail.cuisine.length || detail.tags.length"
            class="title-tags"
          >
            <el-tag
              v-for="c in detail.cuisine"
              :key="`c-${c}`"
              type="warning"
              effect="light"
              size="default"
            >
              {{ c }}
            </el-tag>
            <el-tag
              v-for="t in detail.tags"
              :key="`t-${t}`"
              effect="plain"
              size="default"
            >
              {{ t }}
            </el-tag>
          </div>
        </div>

        <div class="title-actions">
          <button
            class="action-btn"
            :class="{ active: isFavorited }"
            @click="handleFavorite"
          >
            <el-icon>
              <StarFilled v-if="isFavorited" />
              <Star v-else />
            </el-icon>
            <span>{{ isFavorited ? "已收藏" : "收藏" }}</span>
          </button>
          <button class="action-btn" @click="handleShare">
            <el-icon><Share /></el-icon>
            <span>分享</span>
          </button>
        </div>
      </section>

      <!-- ── Content ── -->
      <section class="content-grid">
        <div class="content-main">
          <div v-if="detail.introduction" class="content-card">
            <h2 class="tl-section-title">餐厅介绍</h2>
            <p class="intro-text">{{ detail.introduction }}</p>
          </div>

          <div class="content-card">
            <h2 class="tl-section-title">
              食客评价
              <span
                v-if="detail.reviewSummary.totalReviews > 0"
                class="review-count"
              >
                · {{ detail.reviewSummary.totalReviews }} 条
              </span>
            </h2>

            <div class="review-form">
              <div class="review-form-row">
                <span class="review-form-label">我的评分</span>
                <el-rate v-model="reviewForm.score" :max="5" />
              </div>
              <el-input
                v-model="reviewForm.content"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit
                placeholder="说说菜品的味道、份量、服务、环境..."
              />
              <div class="review-form-actions">
                <el-button
                  type="primary"
                  round
                  :loading="submittingReview"
                  :disabled="!reviewForm.score"
                  @click="submitReview"
                >
                  提交评价
                </el-button>
              </div>
            </div>

            <div
              v-if="detail.reviewSummary.topReviews.length > 0"
              class="review-list"
            >
              <article
                v-for="review in detail.reviewSummary.topReviews"
                :key="review.id"
                class="review-item"
              >
                <el-avatar
                  :size="40"
                  :src="review.user.avatarUrl || undefined"
                >
                  {{ review.user.nickname?.charAt(0) }}
                </el-avatar>
                <div class="review-body">
                  <div class="review-head">
                    <span class="review-name">{{ review.user.nickname }}</span>
                    <el-rate
                      :model-value="review.score"
                      disabled
                      size="small"
                    />
                    <span class="review-date">{{
                      formatDate(review.createdAt)
                    }}</span>
                  </div>
                  <p v-if="review.content" class="review-text">
                    {{ review.content }}
                  </p>
                </div>
              </article>
            </div>
            <div v-else class="no-reviews">
              <span>🍴</span>
              <p>暂无评价，期待你的第一次品鉴</p>
            </div>

            <div
              v-if="detail.reviewSummary.totalReviews > 5"
              class="view-all"
            >
              <el-button
                v-if="!showAllReviews"
                type="primary"
                link
                @click="showAllReviews = true"
              >
                查看全部评价 ({{ detail.reviewSummary.totalReviews }}条)
              </el-button>

              <div v-if="showAllReviews" class="review-list full">
                <article
                  v-for="review in reviews"
                  :key="review.id"
                  class="review-item"
                >
                  <el-avatar
                    :size="40"
                    :src="review.user.avatarUrl || undefined"
                  >
                    {{ review.user.nickname?.charAt(0) }}
                  </el-avatar>
                  <div class="review-body">
                    <div class="review-head">
                      <span class="review-name">{{
                        review.user.nickname
                      }}</span>
                      <el-rate
                        :model-value="review.score"
                        disabled
                        size="small"
                      />
                      <span class="review-date">{{
                        formatDate(review.createdAt)
                      }}</span>
                    </div>
                    <p v-if="review.content" class="review-text">
                      {{ review.content }}
                    </p>
                  </div>
                </article>

                <div v-if="reviews.length < reviewTotal" class="load-more">
                  <el-button
                    :loading="reviewLoading"
                    round
                    @click="loadMoreReviews"
                  >
                    加载更多
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="content-side">
          <div class="content-card info-card">
            <h2 class="tl-section-title">基本信息</h2>
            <ul class="info-list">
              <li>
                <el-icon><Location /></el-icon>
                <div>
                  <span class="info-key">地址</span>
                  <span class="info-val">{{
                    detail.address || detail.city
                  }}</span>
                </div>
              </li>
              <li v-if="detail.openTime">
                <el-icon><Clock /></el-icon>
                <div>
                  <span class="info-key">营业时间</span>
                  <span class="info-val">{{ detail.openTime }}</span>
                </div>
              </li>
              <li v-if="detail.avgCost">
                <el-icon><Money /></el-icon>
                <div>
                  <span class="info-key">人均消费</span>
                  <span class="info-val">¥{{ detail.avgCost }}</span>
                </div>
              </li>
              <li v-if="detail.phone">
                <el-icon><Phone /></el-icon>
                <div>
                  <span class="info-key">咨询电话</span>
                  <span class="info-val">{{ detail.phone }}</span>
                </div>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: 1200px;
  padding-bottom: 60px;
}

.detail-skel,
.state-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  padding: 32px;
  box-shadow: var(--tl-shadow-md);
}

.topbar {
  margin-bottom: 16px;
}

.back-btn {
  font-size: 14px;
  color: var(--tl-text-3);
  background: var(--tl-bg-card);
  padding: 8px 16px;
  border-radius: var(--tl-radius-pill);
  box-shadow: var(--tl-shadow-sm);
}

.back-btn:hover {
  color: #f97316;
}

.back-btn .el-icon {
  margin-right: 4px;
}

.hero-section {
  position: relative;
  border-radius: var(--tl-radius-2xl);
  overflow: hidden;
  box-shadow: var(--tl-shadow-md);
  margin-bottom: 20px;
}

.hero-section :deep(.el-carousel__container) {
  border-radius: var(--tl-radius-2xl) var(--tl-radius-2xl) 0 0;
}

.hero-section :deep(.el-carousel__indicators--outside) {
  background: var(--tl-bg-card);
  padding: 14px 0;
  margin: 0;
}

.hero-img,
.hero-placeholder img {
  width: 100%;
  height: 380px;
  object-fit: cover;
  display: block;
}

.hero-placeholder img {
  height: 280px;
}

.hero-slide {
  position: relative;
  width: 100%;
  height: 380px;
  overflow: hidden;
  background: #1c1917;
}

.hero-slide::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--bg-url);
  background-size: cover;
  background-position: center;
  filter: blur(28px) brightness(0.75) saturate(1.1);
  transform: scale(1.2);
}

.hero-slide .hero-img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero-rating {
  position: absolute;
  right: 28px;
  bottom: 70px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: var(--tl-radius-lg);
  padding: 14px 18px;
  box-shadow: var(--tl-shadow-lg);
  text-align: center;
  min-width: 130px;
}

.hero-rating-score {
  font-size: 28px;
  font-weight: 800;
  color: #f59e0b;
  line-height: 1;
}

.hero-rating-meta {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--tl-text-5);
}

.title-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 28px;
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  box-shadow: var(--tl-shadow-md);
  margin-bottom: 20px;
}

.title-main h1 {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 800;
  color: var(--tl-text-1);
}

.title-location {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--tl-text-4);
}

.title-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.title-tags :deep(.el-tag) {
  border-radius: 6px;
}

.title-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-radius: var(--tl-radius-md);
  background: var(--tl-bg-soft);
  border: 1px solid var(--tl-border-soft);
  color: var(--tl-text-3);
  cursor: pointer;
  transition: all var(--tl-tx);
  font-size: 12px;
  min-width: 70px;
}

.action-btn .el-icon {
  font-size: 18px;
}

.action-btn:hover {
  background: #ffedd5;
  color: #f97316;
  border-color: #fed7aa;
}

.action-btn.active {
  background: #fff7ed;
  color: #f59e0b;
  border-color: #fed7aa;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 20px;
  align-items: flex-start;
}

.content-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.content-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  padding: 24px 28px;
  box-shadow: var(--tl-shadow-md);
}

.intro-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--tl-text-3);
  white-space: pre-line;
  margin: 0;
}

.info-card {
  position: sticky;
  top: 88px;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.info-list .el-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: #ffedd5;
  color: #f97316;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 15px;
}

.info-key {
  display: block;
  font-size: 12px;
  color: var(--tl-text-5);
  margin-bottom: 2px;
}

.info-val {
  display: block;
  font-size: 14px;
  color: var(--tl-text-2);
  word-break: break-word;
}

.review-count {
  font-size: 13px;
  font-weight: 400;
  color: var(--tl-text-5);
  margin-left: 6px;
}

.review-form {
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
  border-radius: var(--tl-radius-lg);
  padding: 18px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.review-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-form-label {
  font-size: 14px;
  color: var(--tl-text-2);
  font-weight: 600;
}

.review-form-actions {
  display: flex;
  justify-content: flex-end;
}

.review-form :deep(.el-textarea__inner) {
  border-radius: 10px;
  background: #fff;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.review-list.full {
  margin-top: 18px;
}

.review-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--tl-bg-soft);
  border-radius: var(--tl-radius-md);
}

.review-body {
  flex: 1;
  min-width: 0;
}

.review-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.review-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--tl-text-2);
}

.review-date {
  margin-left: auto;
  font-size: 12px;
  color: var(--tl-text-5);
}

.review-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--tl-text-3);
}

.no-reviews {
  text-align: center;
  padding: 32px 16px;
  color: var(--tl-text-5);
}

.no-reviews span {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.no-reviews p {
  margin: 0;
  font-size: 13px;
}

.view-all {
  margin-top: 16px;
  text-align: center;
}

.load-more {
  text-align: center;
  margin-top: 14px;
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .info-card {
    position: static;
  }

  .title-section {
    flex-direction: column;
    padding: 20px;
  }

  .title-actions {
    width: 100%;
    justify-content: space-between;
  }

  .hero-rating {
    right: 16px;
    bottom: 60px;
    min-width: 110px;
    padding: 10px 14px;
  }

  .hero-rating-score {
    font-size: 22px;
  }
}

@media (max-width: 640px) {
  .hero-img,
  .hero-placeholder img {
    height: 240px;
  }

  .hero-slide {
    height: 240px;
  }

  .hero-section :deep(.el-carousel__container) {
    height: 240px !important;
  }

  .content-card {
    padding: 18px 20px;
  }
}
</style>
