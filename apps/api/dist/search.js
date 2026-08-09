"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchDocuments = searchDocuments;
exports.logSearch = logSearch;
const db_js_1 = require("./db.js");
const embedding_js_1 = require("./embedding.js");
async function searchDocuments(query, limit = 5) {
    const queryEmbedding = await (0, embedding_js_1.generateEmbedding)(query);
    const result = await db_js_1.db.query(`
    SELECT
      dc.id,
      dc.content,
      dc.chunk_index,
      d.id AS document_id,
      d.name AS document_name,
      d.path AS document_path,

      1 - (dc.embedding <=> $1::vector) AS score

    FROM document_chunks dc

    JOIN documents d
      ON d.id = dc.document_id

    WHERE dc.embedding IS NOT NULL

    ORDER BY dc.embedding <=> $1::vector

    LIMIT $2
    `, [
        `[${queryEmbedding.join(",")}]`,
        limit
    ]);
    return result.rows;
}
async function logSearch(userId, query, resultCount) {
    await db_js_1.db.query(`
    INSERT INTO search_logs (
      user_id,
      query,
      result_count
    )
    VALUES ($1, $2, $3)
    `, [userId, query, resultCount]);
}
