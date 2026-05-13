export interface RestaurantListItem {
  id: string;
  name: string;
  city: string;
  address: string;
  tags: string[];
  cuisine: string[];
  score: number | null;
  avgCost: number | null;
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

export interface RestaurantDetail extends RestaurantListItem {
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

export interface RestaurantReview {
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

export interface MyRestaurantReviewItem {
  id: string;
  score: number;
  content: string | null;
  images: string[];
  status: string;
  createdAt: string;
  restaurant: {
    id: string;
    name: string;
    city: string;
    thumbnail: string | null;
  };
}

export interface SearchRestaurantsParams {
  keyword?: string;
  city?: string;
  tags?: string[];
  cuisine?: string[];
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
