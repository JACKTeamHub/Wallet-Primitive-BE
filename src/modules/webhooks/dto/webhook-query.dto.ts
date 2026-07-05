import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const WebhookQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export class WebhookQueryDto extends createZodDto(WebhookQuerySchema) {}
