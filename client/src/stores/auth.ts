import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/shared/types/auth'
import * as authApi from '@/shared/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => !!user.value)

  async function login(account: string, password: string) {
    loading.value = true
    try {
      const res = await authApi.login({ account, password })
      user.value = res.data!
      return res
    } finally {
      loading.value = false
    }
  }

  async function register(data: {
    email: string
    username: string
    password: string
    captcha: string
    agreeToTerms: boolean
  }) {
    loading.value = true
    try {
      const res = await authApi.register(data)
      user.value = res.data!
      return res
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      logoutLocal()
    }
  }

  function logoutLocal() {
    user.value = null
  }

  async function fetchUser() {
    try {
      const res = await authApi.getCurrentUser()
      if (res.code === 0 && res.data) {
        user.value = res.data
      }
    } catch {
      user.value = null
    }
  }

  return { user, loading, isLoggedIn, login, register, logout, logoutLocal, fetchUser }
})
