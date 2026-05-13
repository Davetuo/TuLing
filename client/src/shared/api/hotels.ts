import { apiClient } from './client'
import type {
  SearchHotelsParams,
  PaginatedResponse,
  HotelListItem,
  HotelDetail,
  HotelReview,
  MyHotelReviewItem,
} from '../types/hotel'

export function searchHotels(params: SearchHotelsParams) {
  return apiClient.get<PaginatedResponse<HotelListItem>>('/hotels', { params })
}

export function getHotelDetail(id: string) {
  return apiClient.get<HotelDetail>(`/hotels/${id}`)
}

// 收藏
export function favoriteHotel(id: string) {
  return apiClient.post(`/hotels/${id}/favorite`)
}

export function unfavoriteHotel(id: string) {
  return apiClient.delete(`/hotels/${id}/favorite`)
}

export function getHotelFavorites(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<HotelListItem>>('/hotels/favorites', {
    params: { page, pageSize },
  })
}

// 评价
export function getHotelReviews(hotelId: string, page = 1, pageSize = 10) {
  return apiClient.get<PaginatedResponse<HotelReview>>(
    `/hotels/${hotelId}/reviews`,
    { params: { page, pageSize } },
  )
}

export function createHotelReview(
  hotelId: string,
  data: { score: number; content?: string },
) {
  return apiClient.post<HotelReview>(`/hotels/${hotelId}/reviews`, data)
}

export function getMyHotelReviews(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<MyHotelReviewItem>>(
    '/hotels/my-reviews',
    { params: { page, pageSize } },
  )
}

export function deleteMyHotelReview(reviewId: string) {
  return apiClient.delete<{ success: boolean }>(`/hotels/my-reviews/${reviewId}`)
}
