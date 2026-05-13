export interface HotelListItem {
  id: string;
  name: string;
  city: string;
  address: string;
  tags: string[];
  score: number | null;
  starLevel: number | null;
  priceMin: number | null;
  priceMax: number | null;
  openTime: string | null;
  images: string[];
  thumbnail: string | null;
  introduction: string | null;
  phone: string | null;
  lng: number | null;
  lat: number | null;
  source: string | null;
  isFavorited?: boolean;
}

export interface HotelDetail extends HotelListItem {
  createdAt: string;
  updatedAt: string;
  reviewSummary: ReviewSummary;
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

export interface HotelReview {
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

export interface MyHotelReviewItem {
  id: string;
  score: number;
  content: string | null;
  images: string[];
  status: string;
  createdAt: string;
  hotel: {
    id: string;
    name: string;
    city: string;
    thumbnail: string | null;
  };
}

export interface SearchHotelsParams {
  keyword?: string;
  city?: string;
  tags?: string[];
  starLevel?: number;
  sort?: 'comprehensive' | 'rating' | 'popularity';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  totalPages: number;
  currentPage: number;
}
