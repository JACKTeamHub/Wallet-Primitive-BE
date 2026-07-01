import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceSchema) {}
