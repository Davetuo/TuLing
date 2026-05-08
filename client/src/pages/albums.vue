<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Picture } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<template>
  <div class="placeholder-page">
    <el-icon :size="64" color="#f56c6c">
      <Picture />
    </el-icon>
    <h2>图片纪念墙</h2>
    <p class="hint">沉淀旅行回忆，功能开发中</p>
    <el-button type="primary" @click="router.push('/home')">返回首页</el-button>
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
