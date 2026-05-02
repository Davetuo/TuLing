<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'
import { ChatDotRound, Search, Picture, List, Star } from '@element-plus/icons-vue'

const authStore = useAuthStore()

const features = [
  { name: '智能问答', desc: 'AI 旅行顾问随时解答', icon: ChatDotRound, color: '#667eea' },
  { name: '景点探索', desc: '发现心仪的目的地', icon: Search, color: '#67c23a' },
  { name: '景点评价', desc: '真实游玩参考', icon: Star, color: '#e6a23c' },
  { name: '行程规划', desc: 'AI 生成专属路线', icon: List, color: '#409eff' },
  { name: '图片纪念墙', desc: '沉淀旅行回忆', icon: Picture, color: '#f56c6c' },
]
</script>

<template>
  <AppLayout>
    <div class="home-page">
      <section class="hero">
        <h2>欢迎回来，{{ authStore.user?.nickname || '旅行者' }}</h2>
        <p>今天想去哪里探索？</p>
      </section>

      <section class="features">
        <el-row :gutter="20">
          <el-col :xs="12" :sm="8" v-for="item in features" :key="item.name">
            <el-card class="feature-card" shadow="hover">
              <el-icon :size="32" :color="item.color">
                <component :is="item.icon" />
              </el-icon>
              <h3>{{ item.name }}</h3>
              <p>{{ item.desc }}</p>
            </el-card>
          </el-col>
        </el-row>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.home-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px;
}

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

.feature-card {
  text-align: center;
  cursor: pointer;
  margin-bottom: 20px;
  border-radius: 12px;
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
</style>
