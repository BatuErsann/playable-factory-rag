"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_js_1 = require("./db.js");
const init_js_1 = require("./db/init.js");
async function seed() {
    await (0, init_js_1.initializeDatabase)();
    const users = [
        {
            username: "demo-user",
            email: "user@playable.com",
            password: "User123",
            role: "USER",
        },
        {
            username: "demo-admin",
            email: "admin@playable.com",
            password: "Admin123",
            role: "ADMIN",
        },
    ];
    for (const user of users) {
        const passwordHash = await bcryptjs_1.default.hash(user.password, 10);
        await db_js_1.db.query(`
      INSERT INTO users (
        username,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email)
      DO UPDATE SET
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role
      `, [
            user.username,
            user.email,
            passwordHash,
            user.role,
        ]);
    }
    console.log("Demo users seeded.");
    await db_js_1.db.end();
}
seed().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
