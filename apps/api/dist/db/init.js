"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("../db.js");
async function initializeDatabase() {
    const schemaPath = path_1.default.resolve(process.cwd(), "src/db/init.sql");
    const schema = await fs_1.default.promises.readFile(schemaPath, "utf8");
    await db_js_1.db.query(schema);
    // Existing local databases created before username support remain compatible.
    await db_js_1.db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT");
    await db_js_1.db.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)");
    await db_js_1.db.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_error TEXT");
    await db_js_1.db.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT");
}
