<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { sendCaptcha } from '@/shared/api/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const captchaLoading = ref(false)
const captchaCooldown = ref(0)
const errorMsg = ref('')

const form = reactive({
  email: '',
  captcha: '',
  username: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
})

const validateConfirmPassword = (_rule: unknown, value: string, callback: (err?: Error) => void) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  captcha: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少 2 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码需包含字母和数字', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
  agreeToTerms: [
    {
      validator: (_rule, value, callback) => {
        if (!value) callback(new Error('请先阅读并同意相关协议'))
        else callback()
      },
      trigger: 'change',
    },
  ],
}

let cooldownTimer: ReturnType<typeof setInterval> | null = null

async function handleSendCaptcha() {
  const valid = await formRef.value?.validateField('email').catch(() => false)
  if (!valid) return

  captchaLoading.value = true
  try {
    await sendCaptcha({ email: form.email })
    captchaCooldown.value = 60
    cooldownTimer = setInterval(() => {
      captchaCooldown.value--
      if (captchaCooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  } catch {
    // Error handled by axios interceptor
  } finally {
    captchaLoading.value = false
  }
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''

  try {
    await authStore.register({
      email: form.email,
      username: form.username,
      password: form.password,
      captcha: form.captcha,
      agreeToTerms: form.agreeToTerms,
    })
    router.push('/home')
  } catch (error: unknown) {
    const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    errorMsg.value = msg || '网络异常，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleRegister">
      <el-form-item prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱地址" clearable />
      </el-form-item>

      <el-form-item prop="captcha">
        <div class="captcha-row">
          <el-input v-model="form.captcha" placeholder="请输入验证码" maxlength="6" />
          <el-button :disabled="captchaCooldown > 0" :loading="captchaLoading" @click="handleSendCaptcha">
            {{ captchaCooldown > 0 ? `${captchaCooldown}s 后重发` : '获取验证码' }}
          </el-button>
        </div>
      </el-form-item>

      <el-form-item prop="username">
        <el-input v-model="form.username" placeholder="请输入用户名" clearable />
      </el-form-item>

      <el-form-item prop="password">
        <el-input v-model="form.password" type="password" placeholder="请输入密码（至少8位，含字母和数字）" show-password clearable />
      </el-form-item>

      <el-form-item prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" show-password clearable />
      </el-form-item>

      <el-form-item prop="agreeToTerms">
        <el-checkbox v-model="form.agreeToTerms">
          我已阅读并同意 <a href="#" @click.prevent>《用户协议》</a> 和 <a href="#" @click.prevent>《隐私政策》</a>
        </el-checkbox>
      </el-form-item>

      <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon :closable="false" style="margin-bottom: 16px" />

      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">
          注册
        </el-button>
      </el-form-item>
    </el-form>

    <div class="auth-footer">
      已有账号？<router-link to="/login">立即登录</router-link>
    </div>
  </AuthLayout>
</template>

<style scoped>
.captcha-row {
  display: flex;
  gap: 12px;
}

.captcha-row .el-button {
  flex-shrink: 0;
  width: 140px;
}

.auth-footer {
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.auth-footer a {
  color: #667eea;
  text-decoration: none;
}
</style>
