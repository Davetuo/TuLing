export interface Memory {
  id: string
  imageUrl: string
  title: string
  location: string
  takenAt: string | null
  width: number | null
  height: number | null
  size: number | null
  createdAt: string
}

export interface MemoryListResp {
  items: Memory[]
  total: number
  totalPages: number
  currentPage: number
}

export interface UploadMemoryPayload {
  file: File
  title?: string
  location?: string
  takenAt?: string
}
