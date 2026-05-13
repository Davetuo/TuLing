import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  favoriteHotel as favApi,
  unfavoriteHotel as unfavApi,
} from '@/shared/api/hotels'

export const useHotelStore = defineStore('hotel', () => {
  const favoriteStatus = ref<Map<string, boolean>>(new Map())

  function setFavoriteStatus(id: string, isFavorited: boolean) {
    favoriteStatus.value.set(id, isFavorited)
  }

  function getFavoriteStatus(id: string): boolean | undefined {
    return favoriteStatus.value.get(id)
  }

  async function toggleFavorite(id: string, currentStatus: boolean) {
    const newStatus = !currentStatus
    setFavoriteStatus(id, newStatus)

    try {
      if (newStatus) {
        await favApi(id)
      } else {
        await unfavApi(id)
      }
      return { success: true, isFavorited: newStatus }
    } catch {
      setFavoriteStatus(id, currentStatus)
      return { success: false, isFavorited: currentStatus }
    }
  }

  function clearCache() {
    favoriteStatus.value.clear()
  }

  return {
    favoriteStatus,
    setFavoriteStatus,
    getFavoriteStatus,
    toggleFavorite,
    clearCache,
  }
})
