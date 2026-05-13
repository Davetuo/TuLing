<route lang="yaml">
meta:
  requiresGuest: true
  layout: auth
</route>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { Lock, Message } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMsg = ref("");

const form = reactive({
  account: "",
  password: "",
  remember: false,
});

const rules: FormRules = {
  account: [{ required: true, message: "请输入邮箱或手机号", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  errorMsg.value = "";

  try {
    await authStore.login(form.account, form.password);
    router.push("/home");
  } catch (error: unknown) {
    const msg = (error as { response?: { data?: { message?: string } } })
      ?.response?.data?.message;
    errorMsg.value = msg || "网络异常，请稍后重试";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    size="large"
    class="auth-form"
    @submit.prevent="handleLogin"
  >
    <el-form-item prop="account">
      <el-input
        v-model="form.account"
        placeholder="请输入邮箱或手机号"
        :prefix-icon="Message"
        clearable
      />
    </el-form-item>

    <el-form-item prop="password">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="请输入密码"
        :prefix-icon="Lock"
        show-password
        clearable
      />
    </el-form-item>

    <div class="form-options">
      <el-checkbox v-model="form.remember">记住密码</el-checkbox>
      <a class="forgot-link" href="#" @click.prevent>忘记密码？</a>
    </div>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="auth-alert"
    />

    <el-form-item class="submit-item">
      <el-button
        type="primary"
        native-type="submit"
        :loading="loading"
        class="submit-btn"
      >
        登 录
      </el-button>
    </el-form-item>
  </el-form>

  <div class="divider">
    <span>或</span>
  </div>

  <div class="auth-footer">
    还没有账号？<router-link to="/register" class="footer-link">立即注册</router-link>
  </div>
</template>

<style scoped>
.auth-form :deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 4px 14px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 13px;
}

.forgot-link {
  color: var(--tl-primary);
  text-decoration: none;
}

.forgot-link:hover {
  color: var(--tl-primary-hover);
}

.auth-alert {
  margin-bottom: 16px;
  border-radius: 12px;
}

.submit-item {
  margin-bottom: 8px;
}

.submit-btn {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
}

.divider {
  position: relative;
  text-align: center;
  margin: 18px 0;
  color: var(--tl-text-5);
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: calc(50% - 24px);
  height: 1px;
  background: var(--tl-border);
}

.divider::before {
  left: 0;
}
.divider::after {
  right: 0;
}

.divider span {
  background: #fff;
  padding: 0 12px;
  position: relative;
}

.auth-footer {
  text-align: center;
  color: var(--tl-text-4);
  font-size: 14px;
}

.footer-link {
  color: var(--tl-primary);
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.footer-link:hover {
  color: var(--tl-primary-hover);
}
</style>
