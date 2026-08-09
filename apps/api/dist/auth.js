"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("./db.js");
const jwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not configured");
    return secret;
};
function publicUser(user) {
    return { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.created_at };
}
function isAuthenticatedUser(payload) {
    return (typeof payload !== "string" &&
        Number.isInteger(payload.id) &&
        typeof payload.username === "string" &&
        (payload.role === "USER" || payload.role === "ADMIN"));
}
function requireAuth(req, res, next) {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
        res.status(401).json({ message: "Authorization token is required" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret());
        if (!isAuthenticatedUser(payload)) {
            res.status(401).json({ message: "Invalid token payload" });
            return;
        }
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
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
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const result = await db_js_1.db.query(`INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'USER')
       RETURNING id, username, email, password_hash, role, created_at`, [normalizedUsername, normalizedEmail, passwordHash]);
        res.status(201).json({ user: publicUser(result.rows[0]) });
    }
    catch (error) {
        if (error.code === "23505") {
            res.status(409).json({ message: "Username or email is already in use" });
            return;
        }
        console.error("User registration failed", error);
        res.status(500).json({ message: "Unable to register user" });
    }
});
exports.authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }
    try {
        const result = await db_js_1.db.query("SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = $1", [email.trim().toLowerCase()]);
        const user = result.rows[0];
        if (!user || !(await bcryptjs_1.default.compare(password, user.password_hash))) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret(), { expiresIn: "24h" });
        res.json({ token, user: publicUser(user) });
    }
    catch (error) {
        console.error("User login failed", error);
        res.status(500).json({ message: "Unable to log in" });
    }
});
exports.authRouter.get("/profile", requireAuth, async (req, res) => {
    const result = await db_js_1.db.query("SELECT id, username, email, password_hash, role, created_at FROM users WHERE id = $1", [req.user.id]);
    const user = result.rows[0];
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    res.json({ user: publicUser(user) });
});
exports.authRouter.post("/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
        res.status(400).json({ message: "Current password and a new password of at least 8 characters are required" });
        return;
    }
    const result = await db_js_1.db.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!result.rows[0] || !(await bcryptjs_1.default.compare(currentPassword, result.rows[0].password_hash))) {
        res.status(401).json({ message: "Current password is incorrect" });
        return;
    }
    await db_js_1.db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcryptjs_1.default.hash(newPassword, 12), req.user.id]);
    res.json({ message: "Password updated successfully" });
});
