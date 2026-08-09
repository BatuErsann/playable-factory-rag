import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { initializeDatabase } from "./db/init.js";

type SeedUser = {
  username: string;
  email: string;
  password: string;
  role: "USER" | "ADMIN";
};

function productionSeedUsers(): SeedUser[] {
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "production-admin";
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for production seeding"
    );
  }

  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters");
  }

  return [{ username, email, password, role: "ADMIN" }];
}

async function seed(): Promise<void> {
  await initializeDatabase();

  const users: readonly SeedUser[] =
    process.env.NODE_ENV === "production"
      ? productionSeedUsers()
      : [
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
