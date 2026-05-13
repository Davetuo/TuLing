import { apiClient } from './client'
import type { Memory, MemoryListResp, UploadMemoryPayload } from '../types/memory'
import type { ApiResponse } from '../types/chat'

export async function listMemories(page = 1, pageSize = 30) {
  const res = await apiClient.get<ApiResponse<MemoryListResp>>('/memories', {
    params: { page, pageSize },
  })
  return res.data.data
}

export async function uploadMemory(payload: UploadMemoryPayload) {
  const form = new FormData()
  // 元数据字段先 append,文件最后 append:即便后端只用 req.file() 也能拿到完整 fields
  if (payload.title) form.append('title', payload.title)
  if (payload.location) form.append('location', payload.location)
  if (payload.takenAt) form.append('takenAt', payload.takenAt)
  form.append('file', payload.file)

  // 不显式设置 Content-Type：让 axios + 浏览器自动附带 boundary
  const res = await apiClient.post<ApiResponse<Memory>>('/memories', form)
  return res.data.data
}

export async function deleteMemory(id: string) {
  const res = await apiClient.delete<ApiResponse<null>>(`/memories/${id}`)
  return res.data.data
}
