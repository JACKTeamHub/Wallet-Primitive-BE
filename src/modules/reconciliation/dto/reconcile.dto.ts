import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReconcileSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID/Reference is required'),
  action: z.enum(['CREDIT', 'REFUND']).default('CREDIT'),
});

export class ReconcileDto extends createZodDto(ReconcileSchema) {}
