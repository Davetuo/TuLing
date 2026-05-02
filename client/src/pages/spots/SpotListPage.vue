<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<template>
  <div class="placeholder-page">
    <el-icon :size="64" color="#67c23a">
      <Search />
    </el-icon>
    <h2>景点探索</h2>
    <p class="hint">发现心仪的目的地，功能开发中</p>
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
