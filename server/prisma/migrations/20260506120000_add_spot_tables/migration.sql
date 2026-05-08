-- 启用 pg_trgm 扩展（模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建景点表
CREATE TABLE "scenic_spots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT '{}',
    "score" DECIMAL(3,1),
    "open_time" VARCHAR(200),
    "images" TEXT[] DEFAULT '{}',
    "introduction" TEXT,
    "transport" TEXT,
    "ticket_info" VARCHAR(500),
    "phone" VARCHAR(50),
    "suggested_duration" VARCHAR(100),
    "source" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenic_spots_pkey" PRIMARY KEY ("id")
);

-- 创建收藏表
CREATE TABLE "spot_favorites" (
    "user_id" UUID NOT NULL,
    "spot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_favorites_pkey" PRIMARY KEY ("user_id","spot_id")
);

-- 创建评价表
CREATE TABLE "spot_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "spot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "content" TEXT,
    "images" TEXT[] DEFAULT '{}',
    "status" VARCHAR(50) NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_reviews_pkey" PRIMARY KEY ("id")
);

-- 索引：景点名称模糊搜索 (pg_trgm)
CREATE INDEX "idx_spots_name_trgm" ON "scenic_spots" USING GIN ("name" gin_trgm_ops);

-- 索引：城市 B-tree
CREATE INDEX "idx_spots_city" ON "scenic_spots" ("city");

-- 索引：标签 GIN
CREATE INDEX "idx_spots_tags" ON "scenic_spots" USING GIN ("tags");

-- 索引：评分排序
CREATE INDEX "idx_spots_score" ON "scenic_spots" ("score" DESC NULLS LAST);

-- 索引：收藏按时间倒序
CREATE INDEX "spot_favorites_user_id_created_at_idx" ON "spot_favorites" ("user_id", "created_at" DESC);

-- 索引：评价按景点+时间
CREATE INDEX "spot_reviews_spot_id_created_at_idx" ON "spot_reviews" ("spot_id", "created_at" DESC);

-- 索引：评价按用户
CREATE INDEX "spot_reviews_user_id_idx" ON "spot_reviews" ("user_id");

-- 外键约束
ALTER TABLE "spot_favorites" ADD CONSTRAINT "spot_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spot_favorites" ADD CONSTRAINT "spot_favorites_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "scenic_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spot_reviews" ADD CONSTRAINT "spot_reviews_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "scenic_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spot_reviews" ADD CONSTRAINT "spot_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
