import { apiClient } from './client'
import type {
  SearchRestaurantsParams,
  PaginatedResponse,
  RestaurantListItem,
  RestaurantDetail,
  RestaurantReview,
  MyRestaurantReviewItem,
} from '../types/restaurant'

export function searchRestaurants(params: SearchRestaurantsParams) {
  return apiClient.get<PaginatedResponse<RestaurantListItem>>('/restaurants', {
    params,
  })
}

export function getRestaurantDetail(id: string) {
  return apiClient.get<RestaurantDetail>(`/restaurants/${id}`)
}

// 收藏
export function favoriteRestaurant(id: string) {
  return apiClient.post(`/restaurants/${id}/favorite`)
}

export function unfavoriteRestaurant(id: string) {
  return apiClient.delete(`/restaurants/${id}/favorite`)
}

export function getRestaurantFavorites(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<RestaurantListItem>>(
    '/restaurants/favorites',
    { params: { page, pageSize } },
  )
}

// 评价
export function getRestaurantReviews(
  restaurantId: string,
  page = 1,
  pageSize = 10,
) {
  return apiClient.get<PaginatedResponse<RestaurantReview>>(
    `/restaurants/${restaurantId}/reviews`,
    { params: { page, pageSize } },
  )
}

export function createRestaurantReview(
  restaurantId: string,
  data: { score: number; content?: string },
) {
  return apiClient.post<RestaurantReview>(
    `/restaurants/${restaurantId}/reviews`,
    data,
  )
}

export function getMyRestaurantReviews(page = 1, pageSize = 20) {
  return apiClient.get<PaginatedResponse<MyRestaurantReviewItem>>(
    '/restaurants/my-reviews',
    { params: { page, pageSize } },
  )
}

export function deleteMyRestaurantReview(reviewId: string) {
  return apiClient.delete<{ success: boolean }>(
    `/restaurants/my-reviews/${reviewId}`,
  )
}
