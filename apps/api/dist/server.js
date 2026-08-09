"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./db.js");
const auth_js_1 = require("./auth.js");
const init_js_1 = require("./db/init.js");
const ingest_js_1 = require("./ingest.js");
const embedding_js_1 = require("./embedding.js");
const search_js_1 = require("./search.js");
const rag_js_1 = require("./rag.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/auth", auth_js_1.authRouter);
//get section
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
app.get("/test-embedding", async (_req, res) => {
    try {
        const embedding = await (0, embedding_js_1.generateEmbedding)("Playable ads improve user engagement.");
        res.json({
            length: embedding.length,
            preview: embedding.slice(0, 5),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Embedding test failed",
        });
    }
});
//post section
app.post("/ingest", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("ADMIN"), async (_req, res) => {
    try {
        await (0, ingest_js_1.ingestDocuments)();
        res.json({
            message: "Ingestion completed",
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Ingestion failed",
        });
    }
});
app.post("/test-store-embedding", async (_req, res) => {
    try {
        const text = "Playable ads improve user engagement.";
        const embedding = await (0, embedding_js_1.generateEmbedding)(text);
        const result = await db_js_1.db.query(`
      INSERT INTO document_chunks (
        document_id,
        chunk_index,
        content,
        embedding
      )
      VALUES ($1, $2, $3, $4::vector)
      RETURNING id
      `, [
            1,
            999,
            text,
            `[${embedding.join(",")}]`
        ]);
        res.json({
            message: "Embedding stored",
            chunkId: result.rows[0].id,
            embeddingLength: embedding.length
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to store embedding"
        });
    }
});
app.post("/search", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("USER", "ADMIN"), async (req, res) => {
    try {
        const { query, limit } = req.body;
        if (!query || typeof query !== "string") {
            return res.status(400).json({
                message: "Query is required"
            });
        }
        const results = await (0, search_js_1.searchDocuments)(query, typeof limit === "number" ? limit : 5);
        res.json({
            query,
            results
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Search failed"
        });
    }
});
app.post("/ask", auth_js_1.requireAuth, (0, auth_js_1.requireRole)("USER", "ADMIN"), async (req, res) => {
    try {
        const { question } = req.body ?? {};
        if (!question || typeof question !== "string") {
            return res.status(400).json({
                message: "Question is required"
            });
        }
        const result = await (0, rag_js_1.answerQuestion)(question);
        res.json({
            question,
            ...result
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to answer question"
        });
    }
});
async function startServer() {
    await (0, init_js_1.initializeDatabase)();
    app.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("API could not start", error);
    process.exit(1);
});
