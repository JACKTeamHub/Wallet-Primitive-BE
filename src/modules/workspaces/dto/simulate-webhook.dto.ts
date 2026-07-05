import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SimulateWebhookSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  transactionId: z.string().optional(),
  narration: z.string().optional().default('Simulated Webhook Deposit'),
});

export class SimulateWebhookDto extends createZodDto(SimulateWebhookSchema) {}
