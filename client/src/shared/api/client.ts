import axios from 'axios'
import { ElMessage } from 'element-plus'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || '网络异常，请稍后重试'

    if (status === 401) {
      const { useAuthStore } = await import('@/stores/auth')
      useAuthStore().logoutLocal()
      // 不在登录/注册页时才跳转，避免循环重定向
      const authPaths = ['/login', '/register']
      if (!authPaths.includes(window.location.pathname)) {
        ElMessage.error(message)
        window.location.href = '/login'
      }
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  },
)

export { apiClient }
