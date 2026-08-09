"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const db_js_1 = require("../db.js");
async function initializeDatabase() {
    await db_js_1.db.query(`
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
    await db_js_1.db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT");
    await db_js_1.db.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)");
}
