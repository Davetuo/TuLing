-- DropIndex
DROP INDEX "idx_spots_city";

-- DropIndex
DROP INDEX "idx_spots_name_trgm";

-- DropIndex
DROP INDEX "idx_spots_score";

-- DropIndex
DROP INDEX "idx_spots_tags";

-- AlterTable
ALTER TABLE "memories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scenic_spots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "spot_reviews" ALTER COLUMN "id" DROP DEFAULT;
