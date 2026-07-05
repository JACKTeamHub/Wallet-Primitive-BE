import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateKycSchema = z.object({
  kycTier: z.enum(['TIER_1', 'TIER_2', 'TIER_3']),
  bvn: z.string().optional(),
  nin: z.string().optional(),
});

export class UpdateKycDto extends createZodDto(UpdateKycSchema) {}
