import type { WeatherDaily } from './weather'

export type Pace = 'relaxed' | 'balanced' | 'compact'

export type NodeType = 'spot' | 'meal' | 'hotel'

export interface RoutePoint {
  id: string
  day: number
  order: number
  name: string
  area: string
  address: string
  start: string
  end: string
  duration: string
  transport: string
  note: string
  lng: number
  lat: number
  rating?: number
  type?: NodeType | string
  category?: string
  cost?: number
  thumbnail?: string
  refId?: string
}

export interface DailyPlan {
  day: number
  date: string
  theme: string
  summary: string
  distance: string
  transitTime: string
  nodes: RoutePoint[]
}

export interface BudgetDetail {
  name: string
  thumbnail?: string
  meta: string         // 例如 "3 晚" / "晚餐" / "门票"
  unitText?: string    // 例如 "¥320/晚 × 3 晚"
  totalCost: number    // 这一明细的小计
  refNodeId?: string   // 关联节点 id；渲染时在 dailyPlans 里反查 RoutePoint
}

export interface BudgetItem {
  label: string
  amount: number
  note: string
  // 阶段 A 扩展字段：住宿/餐饮/门票可展开为具体明细
  expandable?: boolean
  category?: NodeType
  details?: BudgetDetail[]
}

export interface TripPlan {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  days: number
  people: number
  budget: number
  pace: Pace
  preferences: string[]
  createdAt: string
  updatedAt?: string
  summary: string
  dailyPlans: DailyPlan[]
  budgetItems: BudgetItem[]
  weather: WeatherDaily[]
}

export type TripPayload = Omit<TripPlan, 'id' | 'createdAt' | 'updatedAt'>

export interface TripListResp {
  items: TripPlan[]
  total: number
  totalPages: number
  currentPage: number
}
