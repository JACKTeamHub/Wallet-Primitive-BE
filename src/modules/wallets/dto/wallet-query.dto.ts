import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const WalletQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED', 'SUSPENDED']).optional(),
});

export class WalletQueryDto extends createZodDto(WalletQuerySchema) {}
