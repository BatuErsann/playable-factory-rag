import fs from "fs";
import path from "path";

import { db } from "../db.js";

export async function initializeDatabase(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), "src/db/init.sql");
  const schema = await fs.promises.readFile(schemaPath, "utf8");

  await db.query(schema);

  // Existing local databases created before username support remain compatible.
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT");
  await db.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)",
  );

  await db.query(
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT",
  );
  await db.query(
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT",
  );
}
