import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
