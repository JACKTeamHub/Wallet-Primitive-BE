import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { WalletStatus } from '@generated/prisma/client';

export const UpdateWalletStatusSchema = z.object({
  status: z.enum(WalletStatus),
});

export class UpdateWalletStatusDto extends createZodDto(
  UpdateWalletStatusSchema,
) {}
