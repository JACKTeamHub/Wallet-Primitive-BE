import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TransferSchema = z.object({
  senderWalletId: z.string().uuid('Invalid senderWalletId format'),
  recipientWalletId: z.string().uuid('Invalid recipientWalletId format'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
});

export class TransferDto extends createZodDto(TransferSchema) {}
