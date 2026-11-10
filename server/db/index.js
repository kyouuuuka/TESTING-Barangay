import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool });

// Applies pending files in server/drizzle/ (made by `npm run db:generate`).
export const migrateDb = () =>
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
