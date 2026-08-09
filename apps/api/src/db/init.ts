import { db } from "../db.js";

export async function initializeDatabase(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Existing local databases created before username support remain compatible.
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT");
  await db.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)",
  );

  await db.query(
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT",
  );
}
