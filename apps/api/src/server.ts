import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./db.js";
import { authRouter } from "./auth.js";
import { initializeDatabase } from "./db/init.js";
import { ingestDocuments } from "./ingest.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);

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
