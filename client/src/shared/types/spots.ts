export interface SpotListItem {
  id: string;
  name: string;
  city: string;
  address: string;
  tags: string[];
  score: number | null;
  images: string[];
  thumbnail: string | null;
  briefIntro: string | null;
  openTime: string | null;
  isFavorited?: boolean;
}

export interface SpotDetail {
  id: string;
  name: string;
  city: string;
  address: string;
  tags: string[];
  score: number | null;
  openTime: string | null;
  images: string[];
  introduction: string | null;
  transport: string | null;
  ticketInfo: string | null;
  phone: string | null;
  suggestedDuration: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  reviewSummary: ReviewSummary;
  isFavorited?: boolean;
}

export interface ReviewSummary {
  totalReviews: number;
  averageScore: number | null;
  topReviews: ReviewSnippet[];
}

export interface ReviewSnippet {
  id: string;
  score: number;
  content: string | null;
  images: string[];
  createdAt: string;
  user: {
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface SpotReview {
  id: string;
  score: number;
  content: string | null;
  images: string[];
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface SearchSpotsParams {
  keyword?: string;
  city?: string;
  tags?: string[];
  sort?: "comprehensive" | "rating" | "popularity";
  page?: number;
  pageSize?: number;
}
