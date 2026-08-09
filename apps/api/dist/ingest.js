"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
exports.ingestDocuments = ingestDocuments;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./db.js");
const embedding_js_1 = require("./embedding.js");
const CORPUS_PATH = path_1.default.resolve(process.cwd(), "../../corpus");
function readableError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "Unknown ingestion error";
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
            const nestedFiles = await walkDirectory(fullPath);
            files.push(...nestedFiles);
        }
        if (entry.isFile() && entry.name.endsWith(".md")) {
            files.push(fullPath);
        }
    }
    return files;
}
/**
 * Indexes every Markdown file in the corpus and replaces its stored chunks.
 * Each document is isolated so one failure does not stop the remaining files.
 *
 * @returns Counts for all attempted, successful, and failed documents.
 */
async function ingestDocuments() {
    const files = await walkDirectory(CORPUS_PATH);
    let succeeded = 0;
    let failed = 0;
    console.log(`Found ${files.length} markdown files`);
    for (const filePath of files) {
        const relativePath = path_1.default.relative(CORPUS_PATH, filePath);
        const fileName = path_1.default.basename(filePath);
        let documentId;
        try {
            const documentResult = await db_js_1.db.query(`
        INSERT INTO documents (name, path, status, last_error)
        VALUES ($1, $2, 'PENDING', NULL)
        ON CONFLICT (path)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = 'PENDING',
          last_error = NULL
        RETURNING id
        `, [fileName, relativePath]);
            documentId = documentResult.rows[0]?.id;
            if (documentId === undefined) {
                throw new Error("Document record was not created");
            }
            const fileContent = await fs_1.default.promises.readFile(filePath, "utf-8");
            const chunks = chunkText(fileContent);
            await db_js_1.db.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embedding = await (0, embedding_js_1.generateEmbedding)(chunk);
                await db_js_1.db.query(`
          INSERT INTO document_chunks (
            document_id,
            chunk_index,
            content,
            embedding
          )
          VALUES ($1, $2, $3, $4::vector)
          `, [documentId, i, chunk, `[${embedding.join(",")}]`]);
            }
            await db_js_1.db.query(`
        UPDATE documents
        SET status = 'INDEXED',
            indexed_at = CURRENT_TIMESTAMP,
            last_error = NULL
        WHERE id = $1
        `, [documentId]);
            succeeded += 1;
        }
        catch (error) {
            failed += 1;
            const errorMessage = readableError(error);
            console.error(`Failed to ingest ${relativePath}: ${errorMessage}`);
            if (documentId !== undefined) {
                try {
                    await db_js_1.db.query(`
            UPDATE documents
            SET status = 'FAILED',
                last_error = $2
            WHERE id = $1
            `, [documentId, errorMessage]);
                }
                catch (statusError) {
                    console.error(`Failed to persist ingestion error for ${relativePath}: ${readableError(statusError)}`);
                }
            }
        }
    }
    const summary = {
        total: files.length,
        succeeded,
        failed,
    };
    console.log(`Ingestion finished: ${summary.succeeded} succeeded, ${summary.failed} failed`);
    return summary;
}
