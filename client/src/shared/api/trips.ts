import { apiClient } from './client'
import type { ApiResponse } from '../types/chat'
import type { TripListResp, TripPayload, TripPlan } from '../types/trip'

export async function listTrips(page = 1, pageSize = 20) {
  const res = await apiClient.get<ApiResponse<TripListResp>>('/trips', {
    params: { page, pageSize },
  })
  return res.data.data
}

export async function getTrip(id: string) {
  const res = await apiClient.get<ApiResponse<TripPlan>>(`/trips/${id}`)
  return res.data.data
}

export async function createTrip(payload: TripPayload) {
  const res = await apiClient.post<ApiResponse<TripPlan>>('/trips', payload)
  return res.data.data
}

export async function updateTrip(id: string, payload: TripPayload) {
  const res = await apiClient.put<ApiResponse<TripPlan>>(`/trips/${id}`, payload)
  return res.data.data
}

export async function deleteTrip(id: string) {
  const res = await apiClient.delete<ApiResponse<null>>(`/trips/${id}`)
  return res.data.data
}

// ─── AI 文案生成 ──────────────────────────────────────────

export interface NarrativeNode {
  id: string
  name: string
  type: string // 'spot' | 'meal' | 'hotel'
  category?: string
  start: string
  end: string
}

export interface NarrativeDay {
  day: number
  nodes: NarrativeNode[]
}

export interface NarrativePayload {
  destination: string
  days: number
  preferences?: string[]
  pace?: string
  dailyPlans: NarrativeDay[]
}

export interface NarrativeResponse {
  summary: string
  days: Array<{
    day: number
    theme: string
    summary: string
    nodes: Array<{ id: string; note: string }>
  }>
}

export async function generateTripNarrative(
  payload: NarrativePayload,
): Promise<NarrativeResponse | null> {
  const res = await apiClient.post<ApiResponse<NarrativeResponse | null>>(
    '/trips/narrative',
    payload,
    { timeout: 60000 }, // LLM 调用可能 10-30 秒，单独放宽
  )
  // 后端 LLM 失败时返回 code=1, data=null —— 前端按 null 处理回退到模板
  return res.data.code === 0 ? res.data.data : null
}

