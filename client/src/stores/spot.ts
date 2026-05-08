import { defineStore } from 'pinia'
import { ref } from 'vue'
import { favoriteSpot as favApi, unfavoriteSpot as unfavApi } from '@/shared/api/spots'

export const useSpotStore = defineStore('spot', () => {
  // 收藏状态缓存：spotId -> isFavorited
  const favoriteStatus = ref<Map<string, boolean>>(new Map())

  function setFavoriteStatus(spotId: string, isFavorited: boolean) {
    favoriteStatus.value.set(spotId, isFavorited)
  }

  function getFavoriteStatus(spotId: string): boolean | undefined {
    return favoriteStatus.value.get(spotId)
  }

  async function toggleFavorite(spotId: string, currentStatus: boolean) {
    // 乐观更新
    const newStatus = !currentStatus
    setFavoriteStatus(spotId, newStatus)

    try {
      if (newStatus) {
        await favApi(spotId)
      } else {
        await unfavApi(spotId)
      }
      return { success: true, isFavorited: newStatus }
    } catch (error) {
      // 回滚
      setFavoriteStatus(spotId, currentStatus)
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
