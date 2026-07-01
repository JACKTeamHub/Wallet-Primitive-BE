import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterCredentialsSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  subAccountId: z.string().optional(),
});

export class RegisterCredentialsDto extends createZodDto(
  RegisterCredentialsSchema,
) {}
