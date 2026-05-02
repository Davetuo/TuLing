export interface RegisterRequest {
  email: string
  username: string
  password: string
  captcha: string
  agreeToTerms: boolean
}

export interface LoginRequest {
  account: string
  password: string
}

export interface SendCaptchaRequest {
  email: string
}

export interface UserInfo {
  id: string
  email: string
  nickname: string
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}
