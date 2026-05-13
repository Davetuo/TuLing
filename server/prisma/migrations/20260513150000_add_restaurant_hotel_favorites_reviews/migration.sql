-- 餐厅收藏
CREATE TABLE "restaurant_favorites" (
    "user_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_favorites_pkey" PRIMARY KEY ("user_id", "restaurant_id")
);

CREATE INDEX "restaurant_favorites_user_id_created_at_idx" ON "restaurant_favorites" ("user_id", "created_at" DESC);

ALTER TABLE "restaurant_favorites"
  ADD CONSTRAINT "restaurant_favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "restaurant_favorites"
  ADD CONSTRAINT "restaurant_favorites_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 餐厅评价
CREATE TABLE "restaurant_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "content" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "restaurant_reviews_restaurant_id_created_at_idx" ON "restaurant_reviews" ("restaurant_id", "created_at" DESC);
CREATE INDEX "restaurant_reviews_user_id_idx" ON "restaurant_reviews" ("user_id");

ALTER TABLE "restaurant_reviews"
  ADD CONSTRAINT "restaurant_reviews_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "restaurant_reviews"
  ADD CONSTRAINT "restaurant_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 酒店收藏
CREATE TABLE "hotel_favorites" (
    "user_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_favorites_pkey" PRIMARY KEY ("user_id", "hotel_id")
);

CREATE INDEX "hotel_favorites_user_id_created_at_idx" ON "hotel_favorites" ("user_id", "created_at" DESC);

ALTER TABLE "hotel_favorites"
  ADD CONSTRAINT "hotel_favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_favorites"
  ADD CONSTRAINT "hotel_favorites_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 酒店评价
CREATE TABLE "hotel_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "content" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_reviews_hotel_id_created_at_idx" ON "hotel_reviews" ("hotel_id", "created_at" DESC);
CREATE INDEX "hotel_reviews_user_id_idx" ON "hotel_reviews" ("user_id");

ALTER TABLE "hotel_reviews"
  ADD CONSTRAINT "hotel_reviews_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_reviews"
  ADD CONSTRAINT "hotel_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
