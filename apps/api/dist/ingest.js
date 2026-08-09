"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
exports.ingestDocuments = ingestDocuments;
exports.startAutomaticIngestion = startAutomaticIngestion;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./db.js");
const embedding_js_1 = require("./embedding.js");
const CORPUS_PATH = path_1.default.resolve(process.env.CORPUS_PATH ?? path_1.default.join(process.cwd(), "../../corpus"));
const DEFAULT_AUTO_INGEST_INTERVAL_MS = 60_000;
const MIN_AUTO_INGEST_INTERVAL_MS = 5_000;
let activeIngestion;
function readableError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "Unknown ingestion error";
}
function contentHash(content) {
    return (0, crypto_1.createHash)("sha256").update(content, "utf8").digest("hex");
}
function automaticIngestionEnabled() {
    const value = process.env.AUTO_INGEST_ENABLED?.trim().toLowerCase();
    return value !== "false" && value !== "0" && value !== "no";
}
function automaticIngestionIntervalMs() {
    const configuredValue = process.env.AUTO_INGEST_INTERVAL_MS;
    if (configuredValue === undefined) {
        return DEFAULT_AUTO_INGEST_INTERVAL_MS;
    }
    const interval = Number(configuredValue);
    if (!Number.isFinite(interval) || interval < MIN_AUTO_INGEST_INTERVAL_MS) {
        throw new Error(`AUTO_INGEST_INTERVAL_MS must be at least ${MIN_AUTO_INGEST_INTERVAL_MS}`);
    }
    return interval;
}
/**
 * Splits text into fixed-size overlapping chunks.
 *
 * Accepts document text, a maximum chunk size, and the number of characters
 * repeated between adjacent chunks.
 * @returns Ordered document chunks.
 * @throws Error when overlap is not smaller than the chunk size.
 */
function chunkText(text, chunkSize = 800, overlap = 150) {
    if (overlap >= chunkSize) {
        throw new Error("Overlap must be smaller than chunk size");
    }
    const chunks = [];
    const step = chunkSize - overlap;
    for (let i = 0; i < text.length; i += step) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}
async function walkDirectory(dir) {
    const entries = await fs_1.default.promises.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkDirectory(fullPath)));
        }
        if (entry.isFile() && entry.name.endsWith(".md")) {
            files.push(fullPath);
        }
    }
    return files;
}
async function setDocumentPending(name, relativePath) {
    const result = await db_js_1.db.query(`
    INSERT INTO documents (name, path, status, last_error)
    VALUES ($1, $2, 'PENDING', NULL)
    ON CONFLICT (path)
    DO UPDATE SET
      name = EXCLUDED.name,
      status = 'PENDING',
      last_error = NULL
    RETURNING id
    `, [name, relativePath]);
    const documentId = result.rows[0]?.id;
    if (documentId === undefined) {
        throw new Error("Document record was not created");
    }
    return documentId;
}
async function setDocumentFailed(documentId, errorMessage) {
    await db_js_1.db.query(`
    UPDATE documents
    SET status = 'FAILED',
        last_error = $2
    WHERE id = $1
    `, [documentId, errorMessage]);
}
async function embedChunks(chunks) {
    const embeddedChunks = [];
    for (const chunk of chunks) {
        embeddedChunks.push({
            content: chunk,
            embedding: await (0, embedding_js_1.generateEmbedding)(chunk),
        });
    }
    return embeddedChunks;
}
async function replaceDocumentChunks(documentId, hash, chunks) {
    const client = await db_js_1.db.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);
        for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index];
            await client.query(`
        INSERT INTO document_chunks (
          document_id,
          chunk_index,
          content,
          embedding
        )
        VALUES ($1, $2, $3, $4::vector)
        `, [documentId, index, chunk.content, `[${chunk.embedding.join(",")}]`]);
        }
        await client.query(`
      UPDATE documents
      SET status = 'INDEXED',
          indexed_at = CURRENT_TIMESTAMP,
          last_error = NULL,
          content_hash = $2
      WHERE id = $1
      `, [documentId, hash]);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
async function performIncrementalIngestion() {
    const files = await walkDirectory(CORPUS_PATH);
    const existingResult = await db_js_1.db.query("SELECT id, path, status, content_hash FROM documents");
    const existingByPath = new Map(existingResult.rows.map((document) => [document.path, document]));
    const currentPaths = new Set();
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    console.log(`Corpus sync found ${files.length} markdown files`);
    for (const filePath of files) {
        const relativePath = path_1.default.relative(CORPUS_PATH, filePath);
        const fileName = path_1.default.basename(filePath);
        currentPaths.add(relativePath);
        let documentId;
        try {
            const fileContent = await fs_1.default.promises.readFile(filePath, "utf-8");
            const hash = contentHash(fileContent);
            const existingDocument = existingByPath.get(relativePath);
            if (existingDocument?.status === "INDEXED" &&
                existingDocument.content_hash === hash) {
                skipped += 1;
                continue;
            }
            documentId = await setDocumentPending(fileName, relativePath);
            const chunks = chunkText(fileContent, 800, 150);
            const embeddedChunks = await embedChunks(chunks);
            await replaceDocumentChunks(documentId, hash, embeddedChunks);
            succeeded += 1;
        }
        catch (error) {
            failed += 1;
            const errorMessage = readableError(error);
            console.error(`Failed to sync ${relativePath}: ${errorMessage}`);
            if (documentId !== undefined) {
                try {
                    await setDocumentFailed(documentId, errorMessage);
                }
                catch (statusError) {
                    console.error(`Failed to persist sync error for ${relativePath}: ${readableError(statusError)}`);
                }
            }
        }
    }
    const removedPaths = existingResult.rows
        .map((document) => document.path)
        .filter((documentPath) => !currentPaths.has(documentPath));
    let removed = 0;
    if (removedPaths.length > 0) {
        const removedResult = await db_js_1.db.query("DELETE FROM documents WHERE path = ANY($1::text[]) RETURNING id", [removedPaths]);
        removed = removedResult.rowCount ?? 0;
    }
    const summary = {
        total: files.length,
        succeeded,
        failed,
        skipped,
        removed,
    };
    console.log(`Corpus sync finished: ${succeeded} indexed, ${skipped} unchanged, ${failed} failed, ${removed} removed`);
    return summary;
}
/**
 * Synchronizes the corpus with the vector index. Concurrent callers share the
 * same in-flight run so automatic and manual ingestion cannot overlap.
 */
function ingestDocuments() {
    if (activeIngestion !== undefined) {
        return activeIngestion;
    }
    activeIngestion = performIncrementalIngestion().finally(() => {
        activeIngestion = undefined;
    });
    return activeIngestion;
}
/** Starts the initial corpus sync and schedules later incremental scans. */
function startAutomaticIngestion() {
    if (!automaticIngestionEnabled()) {
        console.log("Automatic corpus sync is disabled");
        return;
    }
    const intervalMs = automaticIngestionIntervalMs();
    const synchronize = () => {
        void ingestDocuments().catch((error) => {
            console.error(`Automatic corpus sync failed: ${readableError(error)}`);
        });
    };
    synchronize();
    const timer = setInterval(synchronize, intervalMs);
    timer.unref();
    console.log(`Automatic corpus sync scheduled every ${intervalMs}ms`);
}
