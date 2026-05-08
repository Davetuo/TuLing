import { type Component } from 'vue'
import AppLayout from './AppLayout.vue'
import AuthLayout from './AuthLayout.vue'

export const layouts: Record<string, Component> = {
  app: AppLayout,
  auth: AuthLayout,
}

export const defaultLayout = 'app'
