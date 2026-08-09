import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { initializeDatabase } from "./db/init.js";

async function seed(): Promise<void> {
  await initializeDatabase();

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
  ] as const;

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await db.query(
      `
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
      `,
      [
        user.username,
        user.email,
        passwordHash,
        user.role,
      ]
    );
  }

  console.log("Demo users seeded.");

  await db.end();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});