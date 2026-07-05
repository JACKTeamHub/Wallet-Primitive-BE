import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LedgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class LedgerQueryDto extends createZodDto(LedgerQuerySchema) {}
