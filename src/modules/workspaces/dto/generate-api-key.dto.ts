import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GenerateApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').default('Default API Key'),
});

export class GenerateApiKeyDto extends createZodDto(GenerateApiKeySchema) {}
