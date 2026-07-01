import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(9999),
  APP_NAME: z.string().default('nomba-be'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('password'),
  DB_NAME: z.string().default('nomba_db'),
  DB_PORT: z.coerce.number().default(5432),
  DATABASE_URL: z.string(),
  REDIS_PORT: z.coerce.number().default(6379),
  NOMBA_WEBHOOK_SECRET: z.string().default('NombaHackathon2026'),
  ENCRYPTION_KEY: z
    .string()
    .length(32, 'Encryption key must be exactly 32 bytes'),
});

export type Env = z.infer<typeof envSchema>;

export default () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(result.error.format(), null, 2),
    );
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};
