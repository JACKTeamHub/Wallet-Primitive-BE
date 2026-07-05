import { Prisma } from '@generated/prisma/client';

export interface KycLimits {
  singleTxLimit: Prisma.Decimal;
  dailyLimit: Prisma.Decimal;
}

export const KYC_LIMITS: Record<'TIER_1' | 'TIER_2' | 'TIER_3', KycLimits> = {
  TIER_1: {
    singleTxLimit: new Prisma.Decimal(50000.0), // ₦50,000
    dailyLimit: new Prisma.Decimal(100000.0),   // ₦100,000
  },
  TIER_2: {
    singleTxLimit: new Prisma.Decimal(200000.0), // ₦200,000
    dailyLimit: new Prisma.Decimal(500000.0),   // ₦500,000
  },
  TIER_3: {
    singleTxLimit: new Prisma.Decimal(5000000.0), // ₦5,000,000
    dailyLimit: new Prisma.Decimal(10000000.0),   // ₦10,000,000
  },
};
