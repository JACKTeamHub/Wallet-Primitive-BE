import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RenameCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export class RenameCustomerDto extends createZodDto(RenameCustomerSchema) {}
