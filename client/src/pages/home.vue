<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ChatDotRound, Search, Picture, List, Star } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const features = [
  { name: '智能问答', desc: 'AI 旅行顾问随时解答', icon: ChatDotRound, color: '#667eea', route: '/chat' },
  { name: '景点探索', desc: '发现心仪的目的地', icon: Search, color: '#67c23a', route: '/spots' },
  { name: '景点评价', desc: '真实游玩参考', icon: Star, color: '#e6a23c', route: '/spots' },
  { name: '行程规划', desc: 'AI 生成专属路线', icon: List, color: '#409eff', route: '/trips' },
  { name: '图片纪念墙', desc: '沉淀旅行回忆', icon: Picture, color: '#f56c6c', route: '/albums' },
]

const hotDestinations = [
  { name: '北京', icon: '🏛' },
  { name: '杭州', icon: '🌿' },
  { name: '成都', icon: '🐼' },
  { name: '厦门', icon: '🌊' },
  { name: '西安', icon: '🏯' },
  { name: '三亚', icon: '🏖' },
]

const isOffline = ref(false)

function goFeature(route: string) {
  router.push(route)
}

function goHotDestination(city: string) {
  router.push({ path: '/spots', query: { city } })
}

function handleOnline() { isOffline.value = false }
function handleOffline() { isOffline.value = true }

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  isOffline.value = !navigator.onLine
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <div class="home-page">
    <!-- Network offline alert -->
    <el-alert
      v-if="isOffline"
      title="网络连接异常，请检查网络"
      type="warning"
      :closable="false"
      show-icon
      class="offline-alert"
    />

    <!-- Hero -->
    <section class="hero">
      <h2>欢迎回来，{{ authStore.user?.nickname || '旅行者' }}</h2>
      <p>今天想去哪里探索？</p>
    </section>

    <!-- Feature cards -->
    <section class="features">
      <el-row :gutter="20">
        <el-col :xs="12" :sm="8" v-for="item in features" :key="item.name">
          <el-card class="feature-card" shadow="hover" @click="goFeature(item.route)">
            <el-icon :size="32" :color="item.color">
              <component :is="item.icon" />
            </el-icon>
            <h3>{{ item.name }}</h3>
            <p>{{ item.desc }}</p>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <!-- Shortcut area -->
    <section class="shortcuts">
      <!-- Hot destinations -->
      <div class="shortcut-section">
        <h4>热门目的地</h4>
        <div class="destination-tags">
          <el-tag
            v-for="city in hotDestinations"
            :key="city.name"
            class="dest-tag"
            type="info"
            size="large"
            @click="goHotDestination(city.name)"
          >
            {{ city.icon }} {{ city.name }}
          </el-tag>
        </div>
      </div>

      <!-- Recent trips -->
      <div class="shortcut-section">
        <h4>最近行程</h4>
        <div class="empty-block">
          <el-empty description="暂无行程" :image-size="60" />
          <el-button type="primary" size="small" @click="router.push('/trips')">
            开始规划
          </el-button>
        </div>
      </div>

      <!-- Recent conversations -->
      <div class="shortcut-section">
        <h4>最近对话</h4>
        <div class="empty-block">
          <el-empty description="暂无对话" :image-size="60" />
          <el-button type="primary" size="small" @click="router.push('/chat')">
            开始提问
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px;
}

.offline-alert {
  margin-bottom: 16px;
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: 40px;
}

.hero h2 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 8px;
}

.hero p {
  color: #909399;
  font-size: 16px;
}

/* Feature cards */
.features {
  margin-bottom: 40px;
}

.feature-card {
  text-align: center;
  cursor: pointer;
  margin-bottom: 20px;
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-card h3 {
  margin: 12px 0 4px;
  font-size: 16px;
  color: #303133;
}

.feature-card p {
  color: #909399;
  font-size: 13px;
  margin: 0;
}

/* Shortcuts */
.shortcuts {
  display: flex;
  gap: 24px;
}

.shortcut-section {
  flex: 1;
  min-width: 0;
}

.shortcut-section h4 {
  font-size: 15px;
  color: #303133;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.destination-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dest-tag {
  cursor: pointer;
  transition: transform 0.15s ease;
}

.dest-tag:hover {
  transform: scale(1.05);
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .home-page {
    padding: 24px 12px;
  }

  .hero {
    margin-bottom: 24px;
  }

  .hero h2 {
    font-size: 20px;
  }

  .hero p {
    font-size: 14px;
  }

  .shortcuts {
    flex-direction: column;
    gap: 24px;
  }
}
</style>
