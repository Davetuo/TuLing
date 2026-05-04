import axios from 'axios'
import { ElMessage } from 'element-plus'
import { refreshToken as refreshTokenApi } from './auth'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

// ── Token 刷新队列：并发 401 时只刷新一次，其余请求排队等待 ──
let isRefreshing = false
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = []

function processQueue(error: unknown, token: unknown = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config

    // 401 → 尝试刷新 token，刷新失败才真正登出
    if (status === 401 && !originalRequest._retry) {
      // /auth/refresh 本身失败则不再重试
      if (originalRequest.url?.includes('/auth/refresh')) {
        const { useAuthStore } = await import('@/stores/auth')
        useAuthStore().logoutLocal()
        const authPaths = ['/login', '/register']
        if (!authPaths.includes(window.location.pathname)) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // 已有刷新请求在进行，排队等待
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => apiClient(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await refreshTokenApi()
        processQueue(null)
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        const { useAuthStore } = await import('@/stores/auth')
        useAuthStore().logoutLocal()
        const authPaths = ['/login', '/register']
        if (!authPaths.includes(window.location.pathname)) {
          ElMessage.error('登录已过期，请重新登录')
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const message = error.response?.data?.message || '网络异常，请稍后重试'
    if (status !== 401) {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  },
)

export { apiClient }
