<route lang="yaml">
meta:
  requiresGuest: true
  layout: auth
</route>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  account: '',
  password: '',
  remember: false,
})

const rules: FormRules = {
  account: [{ required: true, message: '请输入邮箱或手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''

  try {
    await authStore.login(form.account, form.password)
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
  <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
    <el-form-item prop="account">
      <el-input v-model="form.account" placeholder="请输入邮箱或手机号" clearable />
    </el-form-item>

    <el-form-item prop="password">
      <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password clearable />
    </el-form-item>

    <div class="form-options">
      <el-checkbox v-model="form.remember">记住密码</el-checkbox>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon :closable="false" style="margin-bottom: 16px" />

    <el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">
        登录
      </el-button>
    </el-form-item>
  </el-form>

  <div class="auth-footer">
    还没有账号？<router-link to="/register">立即注册</router-link>
  </div>
</template>

<style scoped>
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
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
