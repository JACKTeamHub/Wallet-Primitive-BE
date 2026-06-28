import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

const env = config();
expand(env);

export default {
  databaseUrl: process.env.DATABASE_URL,
  dbName: process.env.DB_NAME,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbPort: process.env.DB_PORT,
};
