import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReconciliationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class ReconciliationQueryDto extends createZodDto(ReconciliationQuerySchema) {}
