import express from "express";
import cors from "cors";

import dotenv from "dotenv";
import { db } from "./db.js";
import { authRouter } from "./auth.js";
import { initializeDatabase } from "./db/init.js";

import { ingestDocuments } from "./ingest.js";
import { generateEmbedding } from "./embedding.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);


//get section

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

app.get("/test-embedding", async (_req, res) => {
  try {
    const embedding = await generateEmbedding(
      "Playable ads improve user engagement."
    );

    res.json({
      length: embedding.length,
      preview: embedding.slice(0, 5),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Embedding test failed",
    });
  }
});


//post section

app.post("/ingest", async (_req, res) => {
  try {
    await ingestDocuments();

    res.json({
      message: "Ingestion completed",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Ingestion failed",
    });
  }
});



app.post("/test-store-embedding", async (_req, res) => {
  try {
    const text = "Playable ads improve user engagement.";

    const embedding = await generateEmbedding(text);

    const result = await db.query(
      `
      INSERT INTO document_chunks (
        document_id,
        chunk_index,
        content,
        embedding
      )
      VALUES ($1, $2, $3, $4::vector)
      RETURNING id
      `,
      [
        1,
        999,
        text,
        `[${embedding.join(",")}]`
      ]
    );

    res.json({
      message: "Embedding stored",
      chunkId: result.rows[0].id,
      embeddingLength: embedding.length
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to store embedding"
    });
  }
});

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
