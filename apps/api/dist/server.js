"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_crypto_1 = require("node:crypto");
const server_1 = require("@modelcontextprotocol/server");
const db_js_1 = require("./db.js");
const auth_js_1 = require("./auth.js");
const init_js_1 = require("./db/init.js");
const mcp_server_js_1 = require("./mcp-server.js");
const ingest_js_1 = require("./ingest.js");
const search_js_1 = require("./search.js");
const rag_js_1 = require("./rag.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
const frontendOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
if (frontendOrigins.includes("*")) {
    throw new Error("FRONTEND_URL cannot use a wildcard when credentials are enabled");
}
app.use((0, cors_1.default)({
    origin: frontendOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use("/auth", auth_js_1.authRouter);
const mcpHandler = (0, server_1.createMcpHandler)(() => (0, mcp_server_js_1.createMcpServer)(), {
    responseMode: "json",
});
function hasValidMcpApiKey(authorization) {
    const expectedKey = process.env.MCP_API_KEY;
    if (!expectedKey || !authorization?.startsWith("Bearer ")) {
        return false;
    }
    const suppliedKey = authorization.slice("Bearer ".length);
    const expectedBuffer = Buffer.from(expectedKey);
    const suppliedBuffer = Buffer.from(suppliedKey);
    return (expectedBuffer.length === suppliedBuffer.length &&
        (0, node_crypto_1.timingSafeEqual)(expectedBuffer, suppliedBuffer));
}
app.all("/mcp", async (req, res) => {
    const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    const origin = req.get("origin");
    if (origin && !allowedOrigins.includes(origin)) {
        res.status(403).json({ message: "MCP origin is not allowed" });
        return;
    }
    if (!hasValidMcpApiKey(req.get("authorization"))) {
        res.status(401).set("WWW-Authenticate", "Bearer").json({
            message: "A valid MCP API key is required",
        });
        return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
        if (value) {
            headers.set(name, Array.isArray(value) ? value.join(",") : value);
        }
    }
    const methodHasBody = ["POST", "PUT", "PATCH"].includes(req.method);
    const response = await mcpHandler.fetch(new Request(`https://${req.get("host")}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: methodHasBody ? JSON.stringify(req.body) : undefined,
    }));
    response.headers.forEach((value, name) => res.set(name, value));
    res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
});
// GET routes
app.get("/health", async (_req, res) => {
    try {
        const result = await db_js_1.db.query("SELECT NOW()");
        res.json({
            status: "ok",
            message: "Playable Factory RAG API is running",
            database: "connected",
            databaseTime: result.rows[0].now,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            status: "error",
            database: "disconnected",
        });
    }
});
app.get("/admin/stats", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("ADMIN"), async (_req, res) => {
    try {
        const [documentsResult, chunksResult, embeddedChunksResult, searchesResult,] = await Promise.all([
            db_js_1.db.query("SELECT COUNT(*) FROM documents"),
            db_js_1.db.query("SELECT COUNT(*) FROM document_chunks"),
            db_js_1.db.query("SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL"),
            db_js_1.db.query("SELECT COUNT(*) FROM search_logs"),
        ]);
        res.json({
            documents: Number(documentsResult.rows[0].count),
            chunks: Number(chunksResult.rows[0].count),
            embeddedChunks: Number(embeddedChunksResult.rows[0].count),
            searches: Number(searchesResult.rows[0].count),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch admin stats",
        });
    }
});
app.get("/admin/documents", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("ADMIN"), async (_req, res) => {
    try {
        const result = await db_js_1.db.query(`
        SELECT
          d.id,
          d.name,
          d.path,
          d.status,
          d.last_error,
          d.indexed_at,
          d.created_at,
          COUNT(dc.id)::int AS chunk_count,
          COUNT(dc.embedding)::int AS embedded_chunk_count
        FROM documents d
        LEFT JOIN document_chunks dc
          ON dc.document_id = d.id
        GROUP BY d.id
        ORDER BY d.name ASC
      `);
        res.json({
            documents: result.rows,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch documents",
        });
    }
});
app.get("/admin/search-logs", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("ADMIN"), async (_req, res) => {
    try {
        const result = await db_js_1.db.query(`
        SELECT
          sl.id,
          sl.query,
          sl.result_count,
          sl.created_at,
          u.username,
          u.email
        FROM search_logs sl
        LEFT JOIN users u
          ON u.id = sl.user_id
        ORDER BY sl.created_at DESC
        LIMIT 20
      `);
        res.json({
            searches: result.rows,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch search logs",
        });
    }
});
// POST routes
app.post("/ingest", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("ADMIN"), async (_req, res) => {
    try {
        const summary = await (0, ingest_js_1.ingestDocuments)();
        res.json({
            message: "Ingestion completed",
            ...summary,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Ingestion failed",
        });
    }
});
app.post("/search", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("USER", "ADMIN"), async (req, res) => {
    try {
        const { query, limit } = req.body;
        if (!query || typeof query !== "string") {
            return res.status(400).json({
                message: "Query is required",
            });
        }
        const results = await (0, search_js_1.searchDocuments)(query, typeof limit === "number" ? limit : 5);
        await (0, search_js_1.logSearch)(req.user?.id ?? null, query, results.length);
        res.json({
            query,
            results,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Search failed",
        });
    }
});
app.post("/ask", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("USER", "ADMIN"), async (req, res) => {
    try {
        const { question } = req.body ?? {};
        if (!question || typeof question !== "string") {
            return res.status(400).json({
                message: "Question is required",
            });
        }
        const result = await (0, rag_js_1.answerQuestion)(question);
        await (0, search_js_1.logSearch)(req.user?.id ?? null, question, result.citations.length);
        res.json({
            question,
            ...result,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to answer question",
        });
    }
});
async function startServer() {
    await (0, init_js_1.initializeDatabase)();
    (0, ingest_js_1.startAutomaticIngestion)();
    app.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("API could not start", error);
    process.exit(1);
});
