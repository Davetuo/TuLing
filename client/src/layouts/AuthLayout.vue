<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";

const route = useRoute();

const isRegister = computed(() => route.path === "/register");
</script>

<template>
  <div class="auth-layout">
    <!-- 左侧品牌画面 -->
    <aside class="auth-art">
      <div class="auth-art-bg" />
      <div class="auth-art-overlay" />
      <router-link to="/home" class="auth-brand">
        <div class="auth-brand-mark">T</div>
        <div>
          <div class="auth-brand-name">途灵</div>
          <div class="auth-brand-sub">AI 智能旅行搭子</div>
        </div>
      </router-link>

      <div class="auth-art-text">
        <h2>
          一段
          <span class="auth-grad-text">更轻松、更精彩</span>
          的旅程
        </h2>
        <p>智能问答、景点推荐、行程规划、评价参考 —— 全部交给途灵。</p>
      </div>

      <ul class="auth-art-bullets">
        <li>
          <span class="dot dot-1"></span>
          24h AI 旅行助手随时答疑
        </li>
        <li>
          <span class="dot dot-2"></span>
          个性化定制每一天的路线
        </li>
        <li>
          <span class="dot dot-3"></span>
          真实游客评价，少踩坑
        </li>
      </ul>
    </aside>

    <!-- 右侧表单卡片 -->
    <main class="auth-main">
      <div class="auth-card">
        <header class="auth-header">
          <h1>{{ isRegister ? "创建账号" : "欢迎回来" }}</h1>
          <p>
            {{
              isRegister
                ? "几步搞定，立刻开启你的旅行"
                : "登录账号继续你的旅行之旅"
            }}
          </p>
        </header>
        <slot />
      </div>
      <p class="auth-footnote">© 途灵 · AI 智能旅行搭子</p>
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--tl-bg-page);
}

/* ── 左侧 ── */
.auth-art {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 56px 56px 40px;
  display: flex;
  flex-direction: column;
}

.auth-art-bg {
  position: absolute;
  inset: 0;
  background-image: url("/images/hero-bg.png");
  background-size: cover;
  background-position: center;
}

.auth-art-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    rgba(99, 102, 241, 0.7) 0%,
    rgba(90, 179, 255, 0.45) 50%,
    rgba(244, 114, 182, 0.35) 100%
  );
}

.auth-brand,
.auth-art-text,
.auth-art-bullets {
  position: relative;
  z-index: 1;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  margin-bottom: auto;
}

.auth-brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--tl-primary);
  font-weight: 800;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.auth-brand-name {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.auth-brand-sub {
  font-size: 13px;
  opacity: 0.85;
  margin-top: 2px;
}

.auth-art-text {
  margin: 40px 0 32px;
}

.auth-art-text h2 {
  font-size: 38px;
  font-weight: 800;
  line-height: 1.25;
  margin: 0 0 18px;
  letter-spacing: -0.5px;
  text-shadow: 0 4px 18px rgba(15, 23, 42, 0.2);
}

.auth-grad-text {
  display: inline-block;
  background: linear-gradient(90deg, #fff, #ffe9d1);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.auth-art-text p {
  font-size: 16px;
  line-height: 1.7;
  opacity: 0.92;
  margin: 0;
  max-width: 480px;
}

.auth-art-bullets {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-art-bullets li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.95);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
}

.dot-1 {
  background: #fcd34d;
}
.dot-2 {
  background: #5eead4;
}
.dot-3 {
  background: #f9a8d4;
}

/* ── 右侧 ── */
.auth-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 16px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: var(--tl-radius-2xl);
  padding: 40px 36px;
  box-shadow: var(--tl-shadow-lg);
  border: 1px solid var(--tl-border-soft);
}

.auth-header {
  margin-bottom: 28px;
}

.auth-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 700;
  color: var(--tl-text-1);
}

.auth-header p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 14px;
}

.auth-footnote {
  margin: 0;
  font-size: 12px;
  color: var(--tl-text-5);
}

/* ── 响应式 ── */
@media (max-width: 960px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }

  .auth-art {
    display: none;
  }
}

@media (max-width: 480px) {
  .auth-main {
    padding: 24px 12px;
  }

  .auth-card {
    padding: 28px 22px;
    border-radius: var(--tl-radius-xl);
  }
}
</style>
