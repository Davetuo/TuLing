<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
  ChatDotRound,
  Search,
  Picture,
  List,
  Star,
  ArrowRight,
  Sort,
  View,
  ChatLineRound,
  Right,
  Food,
  House,
} from "@element-plus/icons-vue";
import { searchSpots } from "@/shared/api/spots";

const router = useRouter();

const features = [
  {
    name: "智能问答",
    desc: "24h 在线答疑解惑",
    icon: ChatDotRound,
    bg: "linear-gradient(135deg, #7c83ff 0%, #5ab3ff 100%)",
    route: "/chat",
  },
  {
    name: "景点探索",
    desc: "发现热门景点与攻略",
    icon: Search,
    bg: "linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)",
    route: "/spots",
  },
  {
    name: "美食探店",
    desc: "舌尖上的好味道",
    icon: Food,
    bg: "linear-gradient(135deg, #fb923c 0%, #ef4444 100%)",
    route: "/restaurants",
  },
  {
    name: "酒店住宿",
    desc: "舒心歇脚的好地方",
    icon: House,
    bg: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
    route: "/hotels",
  },
  {
    name: "景点评价",
    desc: "真实评价 综合参考",
    icon: Star,
    bg: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
    route: "/spots/reviews",
  },
  {
    name: "行程规划",
    desc: "个性化定制你的旅程",
    icon: List,
    bg: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
    route: "/trips",
  },
  {
    name: "图片纪念墙",
    desc: "珍藏旅途美好回忆",
    icon: Picture,
    bg: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
    route: "/albums",
  },
];

const aiSuggestions = [
  "推荐适合夏季的避暑胜地",
  "帮我规划一个 3 天的成都之旅",
  "有哪些小众但美丽的海岛？",
];

// 热门目的地的封面图从该城市评分最高景点的实际图片拉取(高德 POI 照片)
// 这样图片必然匹配主题,且证明该城市有数据;失败时保留占位渐变背景
const hotDestinations = ref([
  {
    name: "西安",
    tagline: "千年古都 长安神韵",
    heat: "12.4k 热度",
    image: "",
  },
  {
    name: "杭州",
    tagline: "江南水乡 西湖风光",
    heat: "9.8k 热度",
    image: "",
  },
  {
    name: "成都",
    tagline: "天府之国 美食熊猫",
    heat: "8.6k 热度",
    image: "",
  },
  {
    name: "三亚",
    tagline: "椰风海韵 滨海度假",
    heat: "7.3k 热度",
    image: "",
  },
]);

async function loadDestinationCovers() {
  await Promise.all(
    hotDestinations.value.map(async (dest) => {
      try {
        const res = await searchSpots({
          city: dest.name,
          page: 1,
          pageSize: 1,
          sort: "rating",
        });
        const first = res.data.items[0];
        if (first?.thumbnail) dest.image = first.thumbnail;
      } catch {
        // 静默:fallback 到占位背景
      }
    }),
  );
}

const inspirations = ref([
  {
    title: "夏日避暑胜地推荐",
    desc: "逃离城市酷暑，寻找清凉的夏日旅行地",
    views: "2.1k",
    comments: 56,
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=80&auto=format&fit=crop",
  },
  {
    title: "小众海岛探索指南",
    desc: "避开人潮，发现小众海岛的独特魅力",
    views: "1.8k",
    comments: 34,
    image:
      "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=200&q=80&auto=format&fit=crop",
  },
  {
    title: "3天2夜周边游攻略",
    desc: "短途出行，轻松享受周末好时光",
    views: "3.2k",
    comments: 78,
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80&auto=format&fit=crop",
  },
]);

const isOffline = ref(false);

function goFeature(route: string) {
  router.push(route);
}

function goPlanTrip() {
  router.push("/trips");
}

function goAsk(q: string) {
  router.push({ path: "/chat", query: { q } });
}

function goSpot(name: string) {
  router.push({ path: "/spots", query: { city: name.split("·").pop() } });
}

function reshuffleInspirations() {
  inspirations.value = [...inspirations.value].sort(() => Math.random() - 0.5);
}

function randomDestination() {
  const target =
    hotDestinations.value[
      Math.floor(Math.random() * hotDestinations.value.length)
    ];
  goSpot(target.name);
}

function handleOnline() {
  isOffline.value = false;
}
function handleOffline() {
  isOffline.value = true;
}

onMounted(() => {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  isOffline.value = !navigator.onLine;
  loadDestinationCovers();
});

onUnmounted(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
});
</script>

<template>
  <div class="home-page">
    <el-alert
      v-if="isOffline"
      title="网络连接异常，请检查网络"
      type="warning"
      :closable="false"
      show-icon
      class="offline-alert"
    />

    <!-- ── Hero ── -->
    <section class="hero">
      <div class="hero-bg" />
      <div class="hero-overlay" />
      <div class="hero-inner">
        <div class="hero-text">
          <h1 class="hero-title">
            你的 <span class="grad-text">AI 智能旅行搭子</span>
          </h1>
          <h2 class="hero-subtitle">让每一段旅程更轻松、更精彩</h2>
          <p class="hero-desc">
            智能问答、景点推荐、行程规划、评价参考，<br />
            你的专属旅行助手，带你发现世界的美好。
          </p>
          <el-button
            class="hero-cta"
            size="large"
            round
            @click="goPlanTrip"
          >
            <span>开始规划旅程</span>
            <el-icon class="cta-arrow"><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div class="hero-bubble">
          <div class="bubble-header">
            <div class="bubble-avatar">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div>
              <div class="bubble-greeting">Hi，我是途灵 ✨</div>
              <div class="bubble-subgreeting">
                你的 AI 智能旅行搭子<br />有什么可以帮你的吗？
              </div>
            </div>
          </div>
          <div class="bubble-suggestions">
            <button
              v-for="(q, i) in aiSuggestions"
              :key="i"
              class="suggestion"
              @click="goAsk(q)"
            >
              <span>{{ q }}</span>
              <el-icon><Right /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Features ── -->
    <section class="features">
      <div
        v-for="item in features"
        :key="item.name"
        class="feature-pill"
        @click="goFeature(item.route)"
      >
        <div class="feature-icon" :style="{ background: item.bg }">
          <el-icon :size="22"><component :is="item.icon" /></el-icon>
        </div>
        <div class="feature-text">
          <h3>{{ item.name }}</h3>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ── Main content grid: destinations + inspirations ── -->
    <section class="main-grid">
      <div class="dest-block">
        <div class="block-header">
          <h3>热门目的地</h3>
          <button class="link-btn" @click="router.push('/spots')">
            查看更多
          </button>
        </div>

        <div class="dest-grid">
          <article
            v-for="dest in hotDestinations"
            :key="dest.name"
            class="dest-card"
            @click="goSpot(dest.name)"
          >
            <div
              class="dest-cover"
              :class="{ 'dest-cover-placeholder': !dest.image }"
              :style="
                dest.image ? { backgroundImage: `url(${dest.image})` } : {}
              "
            >
              <span v-if="!dest.image" class="dest-cover-text">{{
                dest.name
              }}</span>
            </div>
            <div class="dest-body">
              <h4>{{ dest.name }}</h4>
              <p>{{ dest.tagline }}</p>
              <span class="dest-heat">🔥 {{ dest.heat }}</span>
            </div>
          </article>
        </div>
      </div>

      <aside class="inspire-block">
        <div class="block-header">
          <h3>旅行灵感</h3>
          <button class="link-btn" @click="reshuffleInspirations">
            <el-icon><Sort /></el-icon>
            <span>换一换</span>
          </button>
        </div>

        <div class="inspire-list">
          <article
            v-for="item in inspirations"
            :key="item.title"
            class="inspire-card"
            @click="router.push('/chat')"
          >
            <div
              class="inspire-cover"
              :style="{ backgroundImage: `url(${item.image})` }"
            />
            <div class="inspire-body">
              <h5>{{ item.title }}</h5>
              <p>{{ item.desc }}</p>
              <div class="inspire-meta">
                <span><el-icon><View /></el-icon>{{ item.views }}</span>
                <span
                  ><el-icon><ChatLineRound /></el-icon>{{ item.comments }}</span
                >
              </div>
            </div>
          </article>
        </div>
      </aside>
    </section>

    <!-- ── CTA banner ── -->
    <section class="cta-banner" @click="randomDestination">
      <div class="cta-banner-art">🗺️</div>
      <div class="cta-banner-text">
        <h4>还没有明确目的地？让途灵给你一些灵感 ✨</h4>
        <p>探索更多可能，发现属于你的完美旅程</p>
      </div>
      <button class="cta-banner-btn">
        <span>随机推荐目的地</span>
        <el-icon><Sort /></el-icon>
      </button>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 32px 48px;
}

.offline-alert {
  margin-bottom: 16px;
}

/* ── Hero ── */
.hero {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  min-height: 480px;
  margin-bottom: 28px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.08);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-image: url("/images/hero-bg.png");
  background-size: cover;
  background-position: center;
  filter: saturate(1.05);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 255, 255, 0.7) 40%,
    rgba(255, 255, 255, 0.1) 65%,
    rgba(255, 255, 255, 0) 100%
  );
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 32px;
  align-items: center;
  padding: 72px 56px;
}

.hero-text {
  max-width: 560px;
}

.hero-title {
  margin: 0;
  font-size: 48px;
  font-weight: 800;
  line-height: 1.15;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.grad-text {
  background: linear-gradient(90deg, #7c83ff 0%, #5ab3ff 50%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-subtitle {
  margin: 14px 0 18px;
  font-size: 28px;
  font-weight: 600;
  color: #1e293b;
}

.hero-desc {
  font-size: 15px;
  color: #475569;
  line-height: 1.8;
  margin: 0 0 32px;
}

.hero-cta {
  background: linear-gradient(135deg, #7c83ff 0%, #5ab3ff 100%);
  border: none;
  color: #fff;
  padding: 14px 28px;
  height: auto;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(112, 124, 255, 0.35);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.hero-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(112, 124, 255, 0.45);
  color: #fff;
}

.cta-arrow {
  margin-left: 8px;
  vertical-align: middle;
}

/* ── AI Bubble ── */
.hero-bubble {
  justify-self: end;
  max-width: 340px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.bubble-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.bubble-avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c83ff 0%, #5ab3ff 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.bubble-greeting {
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
  margin-bottom: 4px;
}

.bubble-subgreeting {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.bubble-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid transparent;
  color: #334155;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.2s;
}

.suggestion:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
  transform: translateX(2px);
}

.suggestion .el-icon {
  color: #6366f1;
  flex-shrink: 0;
}

/* ── Features row ── */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
  background: #fff;
  padding: 22px;
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
  margin-bottom: 28px;
  margin-top: -56px;
  position: relative;
  z-index: 2;
}

.feature-pill {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 10px 8px;
  border-radius: 14px;
  cursor: pointer;
  transition:
    transform 0.2s,
    background 0.2s;
}

.feature-pill:hover {
  background: #f8fafc;
  transform: translateY(-2px);
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  flex-shrink: 0;
}

.feature-text h3 {
  margin: 0 0 4px;
  font-size: 15px;
  color: #1e293b;
  font-weight: 600;
}

.feature-text p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

/* ── Main grid ── */
.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 28px;
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.block-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
  font-weight: 700;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.link-btn:hover {
  background: #eef2ff;
}

/* ── Destinations ── */
.dest-block {
  background: #fff;
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
}

.dest-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.dest-card {
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid #f1f5f9;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.dest-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
}

.dest-cover {
  aspect-ratio: 4 / 3;
  background-color: #e2e8f0;
  background-size: cover;
  background-position: center;
}

.dest-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c83ff 0%, #5ab3ff 100%);
}

.dest-cover-text {
  color: rgba(255, 255, 255, 0.92);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 2px;
}

.dest-body {
  padding: 12px 14px 14px;
}

.dest-body h4 {
  margin: 0 0 4px;
  font-size: 14px;
  color: #1e293b;
  font-weight: 600;
}

.dest-body p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #94a3b8;
}

.dest-heat {
  font-size: 12px;
  color: #f97316;
  font-weight: 600;
}

/* ── Inspirations ── */
.inspire-block {
  background: #fff;
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
}

.inspire-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspire-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.inspire-card:hover {
  background: #f8fafc;
}

.inspire-cover {
  width: 74px;
  height: 74px;
  border-radius: 12px;
  background-color: #e2e8f0;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.inspire-body {
  flex: 1;
  min-width: 0;
}

.inspire-body h5 {
  margin: 0 0 4px;
  font-size: 14px;
  color: #1e293b;
  font-weight: 600;
}

.inspire-body p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.inspire-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #94a3b8;
}

.inspire-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── CTA banner ── */
.cta-banner {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 28px;
  border-radius: 20px;
  background: linear-gradient(100deg, #fdf2f8 0%, #ede9fe 50%, #e0e7ff 100%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: transform 0.2s;
}

.cta-banner:hover {
  transform: translateY(-2px);
}

.cta-banner-art {
  font-size: 48px;
  flex-shrink: 0;
}

.cta-banner-text {
  flex: 1;
  min-width: 0;
}

.cta-banner-text h4 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #1e293b;
  font-weight: 700;
}

.cta-banner-text p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.cta-banner-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #c7d2fe;
  color: #6366f1;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.cta-banner-btn:hover {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

/* ── Responsive ── */
@media (max-width: 1180px) {
  .hero-inner {
    padding: 56px 36px;
  }
  .hero-title {
    font-size: 40px;
  }
  .hero-subtitle {
    font-size: 24px;
  }
  .dest-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .home-page {
    padding: 16px 16px 36px;
  }
  .hero {
    min-height: auto;
  }
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 40px 24px;
  }
  .hero-bubble {
    justify-self: stretch;
    max-width: 100%;
  }
  .hero-title {
    font-size: 32px;
  }
  .hero-subtitle {
    font-size: 20px;
  }
  .features {
    margin-top: 16px;
  }
  .main-grid {
    grid-template-columns: 1fr;
  }
  .cta-banner {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 560px) {
  .dest-grid {
    grid-template-columns: 1fr;
  }
}
</style>
