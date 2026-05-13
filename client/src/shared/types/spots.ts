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

// 我写过的评价（带景点信息回链）
export interface MyReviewItem {
  id: string;
  score: number;
  content: string | null;
  images: string[];
  status: string;
  createdAt: string;
  spot: {
    id: string;
    name: string;
    city: string;
    thumbnail: string | null;
  };
}

// 我收藏景点上别人的评价（个人动态流）
export interface FavoritesReviewItem {
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
  spot: {
    id: string;
    name: string;
    city: string;
    thumbnail: string | null;
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
  sort?: "comprehensive" | "rating" | "popularity" | "review_count";
  page?: number;
  pageSize?: number;
}
