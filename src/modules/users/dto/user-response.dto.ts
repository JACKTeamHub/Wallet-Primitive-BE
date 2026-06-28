import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.any(), // dates might be serialized as strings or Date objects
  updatedAt: z.any(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
