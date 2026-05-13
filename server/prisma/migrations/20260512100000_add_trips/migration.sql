-- 行程规划：用户保存的 AI 行程方案（多日节点、预算、天气）
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "destination" VARCHAR(100) NOT NULL,
    "start_date" VARCHAR(20) NOT NULL,
    "end_date" VARCHAR(20) NOT NULL,
    "days" SMALLINT NOT NULL,
    "people" SMALLINT NOT NULL,
    "budget" INTEGER NOT NULL,
    "pace" VARCHAR(20) NOT NULL,
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL,
    "daily_plans" JSONB NOT NULL,
    "budget_items" JSONB NOT NULL,
    "weather" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- 索引：用户行程按创建时间倒序
CREATE INDEX "trips_user_id_created_at_idx" ON "trips" ("user_id", "created_at" DESC);

-- 外键
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
