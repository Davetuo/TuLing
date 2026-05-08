import { apiClient } from './client'
import type {
  SearchSpotsParams,
  PaginatedResponse,
  SpotListItem,
  SpotDetail,
  SpotReview,
} from '../types/spots'

// 搜索景点
export function searchSpots(params: SearchSpotsParams) {
  return apiClient.get<PaginatedResponse<SpotListItem>>('/spots', { params })
}

// 获取景点详情
export function getSpotDetail(id: string) {
  return apiClient.get<SpotDetail>(`/spots/${id}`)
}

// 收藏景点
export function favoriteSpot(id: string) {
  return apiClient.post(`/spots/${id}/favorite`)
}

// 取消收藏
export function unfavoriteSpot(id: string) {
  return apiClient.delete(`/spots/${id}/favorite`)
}

// 获取收藏列表
export function getFavorites(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<SpotListItem>>('/spots/favorites', {
    params: { page, pageSize },
  })
}

// 获取景点评价列表
export function getSpotReviews(spotId: string, page = 1, pageSize = 10) {
  return apiClient.get<PaginatedResponse<SpotReview>>(`/spots/${spotId}/reviews`, {
    params: { page, pageSize },
  })
}
