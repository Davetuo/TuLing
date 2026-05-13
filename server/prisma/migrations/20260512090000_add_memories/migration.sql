-- 图片纪念墙：用户上传的旅行图片
CREATE TABLE "memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "location" VARCHAR(100) NOT NULL DEFAULT '',
    "taken_at" TIMESTAMP(3),
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- 索引：用户图片墙按时间倒序
CREATE INDEX "memories_user_id_created_at_idx" ON "memories" ("user_id", "created_at" DESC);

-- 外键
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
