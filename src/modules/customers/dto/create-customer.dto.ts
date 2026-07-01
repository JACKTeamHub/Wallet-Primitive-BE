import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
});

export class CreateCustomerDto extends createZodDto(CreateCustomerSchema) {}
