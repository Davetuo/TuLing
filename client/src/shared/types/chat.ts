export interface ChatSession {
  id: string
  title: string
  summary: unknown
  updatedAt: string
  messageCount: number
}

export type PlaceMarkerType = 'spot' | 'restaurant' | 'hotel'

export interface PlaceMarker {
  id: string
  type: PlaceMarkerType
  name: string
  city: string
  address: string
  lat: number | null
  lng: number | null
  score: number | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
  createdAt: string
  // 由 SSE places 事件或从 metadata.places 还原而来 — 驱动地图渲染
  places?: PlaceMarker[]
}

export interface SessionDetail {
  id: string
  title: string
  summary: unknown
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface CreateSessionResponse {
  id: string
  userId: string
  title: string
  updatedAt: string
  createdAt: string
}

export interface SessionListResponse {
  list: ChatSession[]
  total: number
  page: number
  pageSize: number
}

export interface SendMessageRequest {
  sessionId?: string
  content: string
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error' | 'places'
  content?: string
  message?: string
  sessionId: string
  userMessageId?: string
  assistantMessageId?: string
  duration?: number
  places?: PlaceMarker[]
}

export interface Recommendation {
  id: string
  text: string
  category: string
}

export interface ApiResponse<T = unknown> {
  code: number
  message?: string
  data: T
}
