import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { db } from "./db.js";
import { authRouter, requireAuth, requireRole } from "./auth.js";
import { initializeDatabase } from "./db/init.js";
import { ingestDocuments } from "./ingest.js";
import { searchDocuments, logSearch } from "./search.js";
import { answerQuestion } from "./rag.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const frontendOrigins = (
  process.env.FRONTEND_URL ?? "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (frontendOrigins.includes("*")) {
  throw new Error(
    "FRONTEND_URL cannot use a wildcard when credentials are enabled"
  );
}

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use("/auth", authRouter);

// GET routes

app.get("/health", async (_req, res) => {
  try {
    const result = await db.query("SELECT NOW()");

    res.json({
      status: "ok",
      message: "Playable Factory RAG API is running",
      database: "connected",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.get(
  "/admin/stats",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const [
        documentsResult,
        chunksResult,
        embeddedChunksResult,
        searchesResult,
      ] = await Promise.all([
        db.query("SELECT COUNT(*) FROM documents"),
        db.query("SELECT COUNT(*) FROM document_chunks"),
        db.query(
          "SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL"
        ),
        db.query("SELECT COUNT(*) FROM search_logs"),
      ]);

      res.json({
        documents: Number(documentsResult.rows[0].count),
        chunks: Number(chunksResult.rows[0].count),
        embeddedChunks: Number(
          embeddedChunksResult.rows[0].count
        ),
        searches: Number(searchesResult.rows[0].count),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch admin stats",
      });
    }
  }
);

app.get(
  "/admin/documents",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const result = await db.query(`
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
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch documents",
      });
    }
  }
);

app.get(
  "/admin/search-logs",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const result = await db.query(`
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
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch search logs",
      });
    }
  }
);

// POST routes

app.post(
  "/ingest",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const summary = await ingestDocuments();

      res.json({
        message: "Ingestion completed",
        ...summary,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Ingestion failed",
      });
    }
  }
);

app.post(
  "/search",
  requireAuth,
  requireRole("USER", "ADMIN"),
  async (req, res) => {
    try {
      const { query, limit } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({
          message: "Query is required",
        });
      }

      const results = await searchDocuments(
        query,
        typeof limit === "number" ? limit : 5
      );

      await logSearch(
        req.user?.id ?? null,
        query,
        results.length
      );

      res.json({
        query,
        results,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Search failed",
      });
    }
  }
);

app.post(
  "/ask",
  requireAuth,
  requireRole("USER", "ADMIN"),
  async (req, res) => {
    try {
      const { question } = req.body ?? {};

      if (!question || typeof question !== "string") {
        return res.status(400).json({
          message: "Question is required",
        });
      }

      const result = await answerQuestion(question);

      await logSearch(
        req.user?.id ?? null,
        question,
        result.citations.length
      );

      res.json({
        question,
        ...result,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to answer question",
      });
    }
  }
);

async function startServer(): Promise<void> {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("API could not start", error);
  process.exit(1);
});
