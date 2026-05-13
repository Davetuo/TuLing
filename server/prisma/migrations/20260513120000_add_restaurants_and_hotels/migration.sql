-- 餐厅 POI：行程规划用，数据源来自高德 Web 服务 API
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cuisine" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score" DECIMAL(3,1),
    "avg_cost" INTEGER,
    "open_time" VARCHAR(200),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "introduction" TEXT,
    "phone" VARCHAR(50),
    "lng" DECIMAL(10,6),
    "lat" DECIMAL(10,6),
    "source" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "restaurants_city_score_idx" ON "restaurants" ("city", "score" DESC);

-- 酒店 POI：行程规划用，数据源来自高德 Web 服务 API
CREATE TABLE "hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score" DECIMAL(3,1),
    "star_level" SMALLINT,
    "price_min" INTEGER,
    "price_max" INTEGER,
    "open_time" VARCHAR(200),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "introduction" TEXT,
    "phone" VARCHAR(50),
    "lng" DECIMAL(10,6),
    "lat" DECIMAL(10,6),
    "source" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotels_city_score_idx" ON "hotels" ("city", "score" DESC);
