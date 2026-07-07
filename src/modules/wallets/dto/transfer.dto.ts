import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TransferSchema = z.object({
  senderAccountNumber: z.string().min(1, 'Sender account number is required'),
  recipientAccountNumber: z.string().min(1, 'Recipient account number is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
});

export class TransferDto extends createZodDto(TransferSchema) {}
