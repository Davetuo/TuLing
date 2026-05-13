<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  ArrowLeft,
  ChatDotRound,
  Delete,
  Location,
  Star,
  StarFilled,
} from "@element-plus/icons-vue";
import {
  deleteMyReview,
  getFavoritesReviews,
  getMyReviews,
} from "@/shared/api/spots";
import type {
  FavoritesReviewItem,
  MyReviewItem,
} from "@/shared/types/spots";

const router = useRouter();

const myReviews = ref<MyReviewItem[]>([]);
const favReviews = ref<FavoritesReviewItem[]>([]);
const myTotal = ref(0);
const favTotal = ref(0);
const myPage = ref(1);
const favPage = ref(1);
const pageSize = 10;
const loadingMine = ref(false);
const loadingFav = ref(false);

const averageMyScore = computed(() => {
  if (!myReviews.value.length) return null;
  const sum = myReviews.value.reduce((s, r) => s + r.score, 0);
  return (sum / myReviews.value.length).toFixed(1);
});

async function loadMyReviews() {
  loadingMine.value = true;
  try {
    const { data } = await getMyReviews(myPage.value, pageSize);
    myReviews.value = data.items;
    myTotal.value = data.total;
  } catch {
    myReviews.value = [];
  } finally {
    loadingMine.value = false;
  }
}

async function loadFavReviews() {
  loadingFav.value = true;
  try {
    const { data } = await getFavoritesReviews(favPage.value, pageSize);
    favReviews.value = data.items;
    favTotal.value = data.total;
  } catch {
    favReviews.value = [];
  } finally {
    loadingFav.value = false;
  }
}

async function removeReview(id: string) {
  try {
    await ElMessageBox.confirm("确认删除这条评价？删除后无法恢复。", "删除评价", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      confirmButtonClass: "el-button--danger",
    });
  } catch {
    return;
  }

  try {
    await deleteMyReview(id);
    ElMessage.success("已删除");
    myReviews.value = myReviews.value.filter((r) => r.id !== id);
    myTotal.value = Math.max(0, myTotal.value - 1);
  } catch {
    // 全局拦截器已弹错
  }
}

function goSpot(spotId: string) {
  router.push(`/spots/${spotId}`);
}

function goBack() {
  router.back();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

onMounted(() => {
  loadMyReviews();
  loadFavReviews();
});
</script>

<template>
  <div class="tl-page review-hub-page">
    <header class="review-hero">
      <div class="hero-top">
        <el-button text class="back-btn" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="hero-pill">我的评价</span>
      </div>
      <h1>我写过的<span class="tl-grad-text">每一条点评</span></h1>
      <p>管理你给过的星，跟进收藏景点的新动态。</p>
      <div class="hero-stats">
        <div class="stat-chip">
          <el-icon><StarFilled /></el-icon>
          <span><strong>{{ myTotal }}</strong> 条我的评价</span>
        </div>
        <div v-if="averageMyScore" class="stat-chip">
          <el-icon><Star /></el-icon>
          <span>平均给星 <strong>{{ averageMyScore }}</strong></span>
        </div>
        <div class="stat-chip">
          <el-icon><ChatDotRound /></el-icon>
          <span><strong>{{ favTotal }}</strong> 条收藏景点新评价</span>
        </div>
      </div>
    </header>

    <section class="hub-section">
      <div class="section-head">
        <h2><el-icon><StarFilled /></el-icon> 我写过的评价</h2>
        <el-button text @click="router.push('/spots')">去探索景点 →</el-button>
      </div>

      <div v-if="loadingMine" class="state-card">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="!myReviews.length" class="state-card">
        <el-empty description="还没有写过评价" :image-size="100">
          <el-button type="primary" plain @click="router.push('/spots')">
            浏览景点去打分
          </el-button>
        </el-empty>
      </div>

      <div v-else class="my-review-list">
        <article
          v-for="review in myReviews"
          :key="review.id"
          class="my-review-card"
        >
          <div
            class="card-cover"
            :style="{
              backgroundImage: review.spot.thumbnail
                ? `url(${review.spot.thumbnail})`
                : '',
            }"
            @click="goSpot(review.spot.id)"
          >
            <span v-if="!review.spot.thumbnail" class="cover-fallback">🏞️</span>
          </div>
          <div class="card-body">
            <div class="card-head">
              <div>
                <h3 @click="goSpot(review.spot.id)">{{ review.spot.name }}</h3>
                <p>
                  <el-icon><Location /></el-icon>
                  {{ review.spot.city }} · 评于 {{ formatDate(review.createdAt) }}
                </p>
              </div>
              <el-button
                circle
                text
                size="small"
                :icon="Delete"
                class="delete-btn"
                @click="removeReview(review.id)"
              />
            </div>
            <el-rate
              :model-value="review.score"
              disabled
              show-score
              score-template="{value} 星"
              size="small"
            />
            <p v-if="review.content" class="content">{{ review.content }}</p>
            <p v-else class="content empty">（未填写文字评价）</p>
          </div>
        </article>
      </div>

      <div v-if="myTotal > pageSize" class="pager">
        <el-pagination
          v-model:current-page="myPage"
          :page-size="pageSize"
          :total="myTotal"
          layout="prev, pager, next"
          background
          @current-change="loadMyReviews"
        />
      </div>
    </section>

    <section class="hub-section">
      <div class="section-head">
        <h2><el-icon><ChatDotRound /></el-icon> 收藏景点的最新评价</h2>
        <el-button text @click="router.push('/spots/favorites')">
          查看我的收藏 →
        </el-button>
      </div>

      <div v-if="loadingFav" class="state-card">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="!favReviews.length" class="state-card">
        <el-empty description="收藏景点暂无新评价" :image-size="100">
          <el-button type="primary" plain @click="router.push('/spots')">
            去收藏更多景点
          </el-button>
        </el-empty>
      </div>

      <div v-else class="fav-review-list">
        <article
          v-for="review in favReviews"
          :key="review.id"
          class="fav-review-card"
          @click="goSpot(review.spot.id)"
        >
          <header class="fav-card-head">
            <el-avatar :size="36" :src="review.user.avatarUrl || ''">
              {{ review.user.nickname?.[0] || "?" }}
            </el-avatar>
            <div class="head-info">
              <strong>{{ review.user.nickname || "匿名用户" }}</strong>
              <span>评价了 「{{ review.spot.name }}」 · {{ formatDate(review.createdAt) }}</span>
            </div>
            <el-rate
              :model-value="review.score"
              disabled
              size="small"
            />
          </header>
          <p v-if="review.content" class="fav-content">{{ review.content }}</p>
          <p v-else class="fav-content empty">（未填写文字评价）</p>
          <footer class="fav-card-foot">
            <el-icon><Location /></el-icon>
            <span>{{ review.spot.city }} · 点击查看景点详情</span>
          </footer>
        </article>
      </div>

      <div v-if="favTotal > pageSize" class="pager">
        <el-pagination
          v-model:current-page="favPage"
          :page-size="pageSize"
          :total="favTotal"
          layout="prev, pager, next"
          background
          @current-change="loadFavReviews"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.review-hub-page {
  max-width: 1100px;
}

.review-hero {
  padding: 30px 34px;
  border-radius: var(--tl-radius-2xl);
  background: linear-gradient(135deg, #fff7ed 0%, #fdf2f8 60%, #ede9fe 100%);
  margin-bottom: 22px;
  position: relative;
  overflow: hidden;
}

.review-hero::after {
  content: "💬";
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 140px;
  opacity: 0.08;
  pointer-events: none;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
}

.back-btn {
  font-size: 14px;
  color: var(--tl-text-3);
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: var(--tl-radius-pill);
}

.back-btn:hover {
  color: var(--tl-primary);
}

.back-btn .el-icon {
  margin-right: 4px;
}

.hero-pill {
  padding: 4px 12px;
  border-radius: var(--tl-radius-pill);
  background: rgba(255, 255, 255, 0.7);
  color: var(--tl-warning);
  font-size: 12px;
  font-weight: 600;
}

.review-hero h1 {
  margin: 0 0 8px;
  font-size: 30px;
  font-weight: 800;
  color: var(--tl-text-1);
  letter-spacing: -0.3px;
  position: relative;
}

.review-hero > p {
  margin: 0 0 16px;
  color: var(--tl-text-4);
  font-size: 14px;
  line-height: 1.7;
  position: relative;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  position: relative;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--tl-radius-pill);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
  color: var(--tl-text-3);
  font-size: 13px;
}

.stat-chip strong {
  color: var(--tl-text-1);
  font-size: 15px;
  margin: 0 2px;
}

.stat-chip .el-icon {
  color: var(--tl-warning);
}

/* ── Section ── */
.hub-section {
  margin-bottom: 32px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--tl-text-1);
}

.section-head h2 .el-icon {
  color: var(--tl-primary);
}

.state-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  padding: 32px;
  box-shadow: var(--tl-shadow-sm);
  border: 1px solid var(--tl-border-soft);
}

/* ── My review cards ── */
.my-review-list {
  display: grid;
  gap: 14px;
}

.my-review-card {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 16px;
  padding: 16px;
  background: var(--tl-bg-card);
  border: 1px solid var(--tl-border-soft);
  border-radius: var(--tl-radius-lg);
  transition: box-shadow var(--tl-tx);
}

.my-review-card:hover {
  box-shadow: var(--tl-shadow-md);
}

.card-cover {
  width: 110px;
  height: 110px;
  border-radius: var(--tl-radius-md);
  background-size: cover;
  background-position: center;
  background-color: var(--tl-bg-mute);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-fallback {
  font-size: 40px;
  opacity: 0.5;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--tl-text-1);
  cursor: pointer;
}

.card-head h3:hover {
  color: var(--tl-primary);
}

.card-head p {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--tl-text-5);
  font-size: 12px;
}

.delete-btn {
  color: var(--tl-text-5);
}

.delete-btn:hover {
  color: var(--tl-danger);
}

.content {
  margin: 4px 0 0;
  color: var(--tl-text-3);
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.content.empty {
  color: var(--tl-text-5);
  font-style: italic;
}

/* ── Favorites review cards ── */
.fav-review-list {
  display: grid;
  gap: 12px;
}

.fav-review-card {
  padding: 16px 18px;
  background: var(--tl-bg-card);
  border: 1px solid var(--tl-border-soft);
  border-radius: var(--tl-radius-lg);
  cursor: pointer;
  transition: all var(--tl-tx);
}

.fav-review-card:hover {
  border-color: #c7d2fe;
  transform: translateY(-1px);
  box-shadow: var(--tl-shadow-md);
}

.fav-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.head-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.head-info strong {
  font-size: 14px;
  color: var(--tl-text-1);
}

.head-info span {
  font-size: 12px;
  color: var(--tl-text-5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fav-content {
  margin: 0 0 8px;
  color: var(--tl-text-3);
  font-size: 14px;
  line-height: 1.6;
  padding: 10px 12px;
  background: var(--tl-bg-soft);
  border-radius: var(--tl-radius-md);
}

.fav-content.empty {
  color: var(--tl-text-5);
  font-style: italic;
}

.fav-card-foot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tl-text-5);
  font-size: 12px;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

@media (max-width: 720px) {
  .review-hub-page {
    padding: 16px 12px 28px;
  }

  .review-hero {
    padding: 22px;
  }

  .review-hero h1 {
    font-size: 22px;
  }

  .my-review-card {
    grid-template-columns: 80px 1fr;
  }

  .card-cover {
    width: 80px;
    height: 80px;
  }
}
</style>
