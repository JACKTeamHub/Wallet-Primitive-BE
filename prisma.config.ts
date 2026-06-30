import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig, env } from 'prisma/config';

expand(config());

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
