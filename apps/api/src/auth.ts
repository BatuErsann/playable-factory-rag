import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { db } from "./db.js";

export type UserRole = "USER" | "ADMIN";

type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
};

type AuthenticatedRequest = Request & { user?: JwtPayload & { id: number; role: UserRole; username: string } };

const jwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

function publicUser(user: UserRow) {
  return { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.created_at };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ message: "Authorization token is required" });
    return;
  }

  try {
    req.user = jwt.verify(token, jwtSecret()) as AuthenticatedRequest["user"];
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { username, email, password } = req.body as Record<string, unknown>;
  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "Username, email and password are required" });
    return;
  }

  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedUsername || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || password.length < 8) {
    res.status(400).json({ message: "Enter a username, valid email and password of at least 8 characters" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query<UserRow>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'USER')
       RETURNING id, username, email, password_hash, role, created_at`,
      [normalizedUsername, normalizedEmail, passwordHash],
    );
    res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ message: "Username or email is already in use" });
      return;
    }
    console.error("User registration failed", error);
    res.status(500).json({ message: "Unable to register user" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  try {
    const result = await db.query<UserRow>(
      "SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = $1",
      [email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret(), { expiresIn: "24h" });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error("User login failed", error);
    res.status(500).json({ message: "Unable to log in" });
  }
});

authRouter.get("/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  const result = await db.query<UserRow>(
    "SELECT id, username, email, password_hash, role, created_at FROM users WHERE id = $1",
    [req.user!.id],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

authRouter.post("/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body as Record<string, unknown>;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ message: "Current password and a new password of at least 8 characters are required" });
    return;
  }

  const result = await db.query<Pick<UserRow, "password_hash">>("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  if (!result.rows[0] || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
    res.status(401).json({ message: "Current password is incorrect" });
    return;
  }

  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(newPassword, 12), req.user!.id]);
  res.json({ message: "Password updated successfully" });
});
