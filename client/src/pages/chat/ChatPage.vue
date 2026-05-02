<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ChatDotRound } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<template>
  <div class="placeholder-page">
    <el-icon :size="64" color="#667eea">
      <ChatDotRound />
    </el-icon>
    <h2>智能问答</h2>
    <p class="hint">AI 旅行搭子即将上线，敬请期待</p>
    <el-button type="primary" @click="router.push({ name: 'Home' })">返回首页</el-button>
  </div>
</template>

<style scoped>
.placeholder-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  text-align: center;
}

.placeholder-page h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.hint {
  color: #909399;
  font-size: 14px;
  margin: 0;
}
</style>
