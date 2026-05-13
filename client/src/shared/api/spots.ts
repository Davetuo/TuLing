import { apiClient } from './client'
import type {
  SearchSpotsParams,
  PaginatedResponse,
  SpotListItem,
  SpotDetail,
  SpotReview,
  MyReviewItem,
  FavoritesReviewItem,
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

// 提交景点评价
export function createSpotReview(
  spotId: string,
  data: { score: number; content?: string },
) {
  return apiClient.post<SpotReview>(`/spots/${spotId}/reviews`, data)
}

// 我写过的评价
export function getMyReviews(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<MyReviewItem>>('/spots/my-reviews', {
    params: { page, pageSize },
  })
}

// 删除我的某条评价
export function deleteMyReview(reviewId: string) {
  return apiClient.delete<{ success: boolean }>(`/spots/my-reviews/${reviewId}`)
}

// 我收藏景点上别人的新评价（个人动态流）
export function getFavoritesReviews(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<FavoritesReviewItem>>(
    '/spots/favorites-reviews',
    { params: { page, pageSize } },
  )
}
