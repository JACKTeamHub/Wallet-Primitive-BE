import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StatementQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class StatementQueryDto extends createZodDto(StatementQuerySchema) {}
