import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(15),
  action: z.string().optional(),
  actor: z.string().optional(),
});

export class AuditLogQueryDto extends createZodDto(AuditLogQuerySchema) {}
