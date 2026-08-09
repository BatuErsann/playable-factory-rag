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
//overlapping 0-999  then  800-1799 ... 
function chunkText(text, chunkSize = 800, overlap = 150) {
    //err handling for overlap greater than chunk size
    if (overlap >= chunkSize) {
        throw new Error("Overlap must be smaller than chunk size");
    }
    const chunks = [];
    const step = chunkSize - overlap;
    for (let i = 0; i < text.length; i += step) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push(chunk);
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
async function ingestDocuments() {
    const files = await walkDirectory(CORPUS_PATH);
    console.log(`Found ${files.length} markdown files`);
    for (const filePath of files) {
        const relativePath = path_1.default.relative(CORPUS_PATH, filePath);
        const fileName = path_1.default.basename(filePath);
        const fileContent = await fs_1.default.promises.readFile(filePath, "utf-8");
        const documentResult = await db_js_1.db.query(`
      INSERT INTO documents (name, path, status)
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (path)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = 'PENDING'
      RETURNING id
      `, [fileName, relativePath]);
        const documentId = documentResult.rows[0].id;
        const chunks = chunkText(fileContent);
        await db_js_1.db.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
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
        `, [
                documentId,
                i,
                chunk,
                `[${embedding.join(",")}]`
            ]);
        }
        // 7. Document tamamlandı
        await db_js_1.db.query(`
      UPDATE documents
      SET status = 'INDEXED',
          indexed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `, [documentId]);
    }
    console.log("Documents and embeddings saved to database");
    console.log("Documents saved to database");
}
