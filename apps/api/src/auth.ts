import bcrypt from "bcryptjs";
import {
  Router,
  type CookieOptions,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { db } from "./db.js";

export type UserRole = "USER" | "ADMIN";

const AUTH_COOKIE_NAME = "playable_factory_token";
const AUTH_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;

type AuthenticatedUser = JwtPayload & {
  id: number;
  role: UserRole;
  username: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
};

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

const jwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

function cookieSameSite(): CookieOptions["sameSite"] {
  const value = process.env.COOKIE_SAME_SITE?.toLowerCase() ?? "lax";
  if (value === "lax" || value === "strict" || value === "none") return value;
  throw new Error("COOKIE_SAME_SITE must be lax, strict, or none");
}

function cookieIsSecure(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return false;
}

function authCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  const secure = cookieIsSecure();
  if (sameSite === "none" && !secure) {
    throw new Error("COOKIE_SAME_SITE=none requires a secure cookie");
  }

  const options: CookieOptions = {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) options.domain = process.env.COOKIE_DOMAIN;
  return options;
}

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex < 0) continue;

    const cookieName = cookie.slice(0, separatorIndex).trim();
    if (cookieName !== name) continue;

    try {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function readBearerToken(req: Request): string | undefined {
  const authorization = req.header("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
}

function publicUser(user: UserRow) {
  return { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.created_at };
}

function isAuthenticatedUser(payload: string | JwtPayload): payload is AuthenticatedUser {
  return (
    typeof payload !== "string" &&
    Number.isInteger(payload.id) &&
    typeof payload.username === "string" &&
    (payload.role === "USER" || payload.role === "ADMIN")
  );
}

/**
 * Express middleware that authenticates an HttpOnly cookie or Bearer token.
 * Cookie authentication takes precedence when both are supplied.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = readCookie(req, AUTH_COOKIE_NAME) ?? readBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Authentication token is required" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    if (!isAuthenticatedUser(payload)) {
      res.status(401).json({ message: "Invalid token payload" });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Builds Express middleware that permits only the supplied application roles.
 * Must run after `requireAuth`.
 *
 * Accepts the roles allowed to continue to the route handler.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication is required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

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

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret(),
      { expiresIn: AUTH_TOKEN_MAX_AGE_SECONDS },
    );

    res.cookie(AUTH_COOKIE_NAME, token, {
      ...authCookieOptions(),
      maxAge: AUTH_TOKEN_MAX_AGE_SECONDS * 1000,
    });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("User login failed", error);
    res.status(500).json({ message: "Unable to log in" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  res.json({ message: "Logged out successfully" });
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
