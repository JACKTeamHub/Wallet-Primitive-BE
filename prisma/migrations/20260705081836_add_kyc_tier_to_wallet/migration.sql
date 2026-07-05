-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "bvn" TEXT,
ADD COLUMN     "kycTier" "KycTier" NOT NULL DEFAULT 'TIER_1',
ADD COLUMN     "nin" TEXT;
