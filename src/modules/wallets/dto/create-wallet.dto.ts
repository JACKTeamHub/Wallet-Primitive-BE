import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateWalletSchema = z.object({
  customerId: z.uuid('Invalid customerId format'),
  bvn: z.string().length(11, 'BVN must be exactly 11 digits'),
});

export class CreateWalletDto extends createZodDto(CreateWalletSchema) {}
