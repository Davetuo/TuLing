<route lang="yaml">
meta:
  requiresGuest: true
  layout: auth
</route>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { sendCaptcha } from "@/shared/api/auth";
import { Lock, Message, User, Key } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";

const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const captchaLoading = ref(false);
const captchaCooldown = ref(0);
const errorMsg = ref("");

const form = reactive({
  email: "",
  captcha: "",
  username: "",
  password: "",
  confirmPassword: "",
  agreeToTerms: false,
});

const validateConfirmPassword = (
  _rule: unknown,
  value: string,
  callback: (err?: Error) => void,
) => {
  if (value !== form.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const rules: FormRules = {
  email: [
    { required: true, message: "请输入邮箱地址", trigger: "blur" },
    { type: "email", message: "请输入有效的邮箱地址", trigger: "blur" },
  ],
  captcha: [{ required: true, message: "请输入验证码", trigger: "blur" }],
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, message: "用户名至少 2 个字符", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, message: "密码至少 8 位", trigger: "blur" },
    {
      pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
      message: "密码需包含字母和数字",
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    { validator: validateConfirmPassword, trigger: "blur" },
  ],
  agreeToTerms: [
    {
      validator: (_rule, value, callback) => {
        if (!value) callback(new Error("请先阅读并同意相关协议"));
        else callback();
      },
      trigger: "change",
    },
  ],
};

let cooldownTimer: ReturnType<typeof setInterval> | null = null;

async function handleSendCaptcha() {
  const valid = await formRef.value?.validateField("email").catch(() => false);
  if (!valid) return;

  captchaLoading.value = true;
  try {
    await sendCaptcha({ email: form.email });
    captchaCooldown.value = 60;
    cooldownTimer = setInterval(() => {
      captchaCooldown.value--;
      if (captchaCooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  } catch {
    // Error handled by axios interceptor
  } finally {
    captchaLoading.value = false;
  }
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  errorMsg.value = "";

  try {
    await authStore.register({
      email: form.email,
      username: form.username,
      password: form.password,
      captcha: form.captcha,
      agreeToTerms: form.agreeToTerms,
    });
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
    @submit.prevent="handleRegister"
  >
    <el-form-item prop="email">
      <el-input
        v-model="form.email"
        placeholder="请输入邮箱地址"
        :prefix-icon="Message"
        clearable
      />
    </el-form-item>

    <el-form-item prop="captcha">
      <div class="captcha-row">
        <el-input
          v-model="form.captcha"
          placeholder="验证码"
          :prefix-icon="Key"
          maxlength="6"
        />
        <el-button
          :disabled="captchaCooldown > 0"
          :loading="captchaLoading"
          class="captcha-btn"
          @click="handleSendCaptcha"
        >
          {{ captchaCooldown > 0 ? `${captchaCooldown}s` : "获取验证码" }}
        </el-button>
      </div>
    </el-form-item>

    <el-form-item prop="username">
      <el-input
        v-model="form.username"
        placeholder="请输入用户名"
        :prefix-icon="User"
        clearable
      />
    </el-form-item>

    <el-form-item prop="password">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="密码至少 8 位，含字母和数字"
        :prefix-icon="Lock"
        show-password
        clearable
      />
    </el-form-item>

    <el-form-item prop="confirmPassword">
      <el-input
        v-model="form.confirmPassword"
        type="password"
        placeholder="请再次输入密码"
        :prefix-icon="Lock"
        show-password
        clearable
      />
    </el-form-item>

    <el-form-item prop="agreeToTerms" class="terms-item">
      <el-checkbox v-model="form.agreeToTerms" class="terms-check">
        我已阅读并同意
        <a class="footer-link" href="#" @click.prevent>《用户协议》</a>
        和
        <a class="footer-link" href="#" @click.prevent>《隐私政策》</a>
      </el-checkbox>
    </el-form-item>

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
        注 册
      </el-button>
    </el-form-item>
  </el-form>

  <div class="auth-footer">
    已有账号？<router-link to="/login" class="footer-link">立即登录</router-link>
  </div>
</template>

<style scoped>
.auth-form :deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 4px 14px;
}

.captcha-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.captcha-row .el-input {
  flex: 1;
}

.captcha-btn {
  flex-shrink: 0;
  width: 130px;
  border-radius: 12px;
  background: var(--tl-primary-soft);
  color: var(--tl-primary);
  border: 1px solid #c7d2fe;
  font-weight: 500;
}

.captcha-btn:not(.is-disabled):hover {
  background: var(--tl-primary);
  color: #fff;
  border-color: var(--tl-primary);
}

.terms-item {
  margin-bottom: 14px;
}

.terms-check :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--tl-text-4);
}

.auth-alert {
  margin-bottom: 16px;
  border-radius: 12px;
}

.submit-item {
  margin-bottom: 12px;
}

.submit-btn {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
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
}

.footer-link:hover {
  color: var(--tl-primary-hover);
}
</style>
