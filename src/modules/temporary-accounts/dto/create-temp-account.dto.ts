import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTempAccountSchema = z.object({
  expectedAmount: z.number().positive('Expected amount must be positive'),
  expiresInSeconds: z.number().positive().default(3600),
  accountName: z.string().min(1, 'Account name is required').optional(),
});

export class CreateTempAccountDto extends createZodDto(
  CreateTempAccountSchema,
) {}
