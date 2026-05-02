<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <div class="auth-card">
      <div class="auth-header">
        <h1>途灵</h1>
        <p>AI 智能旅行搭子</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-header h1 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 8px;
}

.auth-header p {
  color: #909399;
  margin: 0;
}
</style>
