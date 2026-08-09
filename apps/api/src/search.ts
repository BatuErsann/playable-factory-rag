import { db } from "./db.js";
import { generateEmbedding } from "./embedding.js";

/**
 * Searches indexed chunks by pgvector cosine distance.
 *
 * Accepts natural-language query text and an optional maximum result count.
 * @returns Database rows containing chunk metadata and similarity scores.
 */
export async function searchDocuments(
  query: string,
  limit = 5
) {
  const queryEmbedding = await generateEmbedding(query);

  const result = await db.query(
    `
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
    `,
    [
      `[${queryEmbedding.join(",")}]`,
      limit
    ]
  );

  return result.rows;
}

/**
 * Records a semantic search or RAG question for usage reporting.
 *
 * Stores the user identifier, submitted query, and retrieved result count.
 */
export async function logSearch(
  userId: number | null,
  query: string,
  resultCount: number
) {
  await db.query(
    `
    INSERT INTO search_logs (
      user_id,
      query,
      result_count
    )
    VALUES ($1, $2, $3)
    `,
    [userId, query, resultCount]
  );
}
