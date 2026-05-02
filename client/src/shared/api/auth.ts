import { apiClient } from './client'
import type { RegisterRequest, LoginRequest, SendCaptchaRequest, UserInfo, ApiResponse } from '@/shared/types/auth'

export async function register(data: RegisterRequest) {
  const res = await apiClient.post<ApiResponse<UserInfo>>('/auth/register', data)
  return res.data
}

export async function login(data: LoginRequest) {
  const res = await apiClient.post<ApiResponse<UserInfo>>('/auth/login', data)
  return res.data
}

export async function logout() {
  const res = await apiClient.post<ApiResponse>('/auth/logout')
  return res.data
}

export async function sendCaptcha(data: SendCaptchaRequest) {
  const res = await apiClient.post<ApiResponse>('/auth/captcha', data)
  return res.data
}

export async function refreshToken() {
  const res = await apiClient.post<ApiResponse>('/auth/refresh')
  return res.data
}

export async function getCurrentUser() {
  const res = await apiClient.get<ApiResponse<UserInfo>>('/auth/me')
  return res.data
}
