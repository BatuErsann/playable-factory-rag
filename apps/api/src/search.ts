import { db } from "./db.js";
import { generateEmbedding } from "./embedding.js";

export type SearchMode = "semantic" | "hybrid";

export type SearchResult = {
  id: number;
  content: string;
  chunk_index: number;
  document_id: number;
  document_name: string;
  document_path: string;
  score: number;
  keyword_score: number;
  hybrid_score: number;
  vector_rank: number | null;
  keyword_rank: number | null;
};

const RRF_K = 60;
const MIN_CANDIDATE_COUNT = 30;
const CANDIDATE_MULTIPLIER = 6;

const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function buildKeywordQuery(query: string): string {
  const rawTokens =
    query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu) ?? [];

  const meaningfulTokens = rawTokens.filter(
    (token) => !ENGLISH_STOP_WORDS.has(token)
  );
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;
  const uniqueTokens = [...new Set(tokens)];

  return uniqueTokens.map((token) => `"${token}"`).join(" OR ");
}

async function semanticSearch(
  queryEmbedding: number[],
  limit: number
): Promise<SearchResult[]> {
  const result = await db.query<SearchResult>(
    `
    SELECT
      dc.id,
      dc.content,
      dc.chunk_index,
      d.id AS document_id,
      d.name AS document_name,
      d.path AS document_path,
      1 - (dc.embedding <=> $1::vector) AS score,
      0::real AS keyword_score,
      1 - (dc.embedding <=> $1::vector) AS hybrid_score,
      (ROW_NUMBER() OVER (
        ORDER BY dc.embedding <=> $1::vector
      ))::int AS vector_rank,
      NULL::int AS keyword_rank
    FROM document_chunks dc
    JOIN documents d
      ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $2
    `,
    [`[${queryEmbedding.join(",")}]`, limit]
  );

  return result.rows;
}

async function hybridSearch(
  queryEmbedding: number[],
  keywordQuery: string,
  limit: number
): Promise<SearchResult[]> {
  const candidateLimit = Math.max(
    MIN_CANDIDATE_COUNT,
    Math.ceil(limit * CANDIDATE_MULTIPLIER)
  );

  const result = await db.query<SearchResult>(
    `
    WITH query_input AS (
      SELECT
        $1::vector AS embedding,
        websearch_to_tsquery('simple', $2) AS keyword_query
    ),
    searchable_chunks AS (
      SELECT
        dc.id,
        dc.content,
        dc.chunk_index,
        dc.embedding,
        d.id AS document_id,
        d.name AS document_name,
        d.path AS document_path,
        setweight(
          to_tsvector('simple', COALESCE(d.name, '')),
          'A'
        ) ||
        setweight(
          to_tsvector('simple', COALESCE(d.path, '')),
          'A'
        ) ||
        setweight(
          to_tsvector('simple', COALESCE(dc.content, '')),
          'B'
        ) AS search_vector
      FROM document_chunks dc
      JOIN documents d
        ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
    ),
    vector_scored AS (
      SELECT
        sc.*,
        1 - (sc.embedding <=> qi.embedding) AS vector_score
      FROM searchable_chunks sc
      CROSS JOIN query_input qi
    ),
    vector_candidates AS (
      SELECT
        vs.*,
        (ROW_NUMBER() OVER (
          ORDER BY vs.vector_score DESC
        ))::int AS vector_rank
      FROM vector_scored vs
      ORDER BY vs.vector_score DESC
      LIMIT $3
    ),
    keyword_scored AS (
      SELECT
        sc.*,
        1 - (sc.embedding <=> qi.embedding) AS vector_score,
        ts_rank_cd(
          sc.search_vector,
          qi.keyword_query,
          32
        ) AS keyword_score
      FROM searchable_chunks sc
      CROSS JOIN query_input qi
      WHERE sc.search_vector @@ qi.keyword_query
    ),
    keyword_candidates AS (
      SELECT
        ks.*,
        (ROW_NUMBER() OVER (
          ORDER BY ks.keyword_score DESC, ks.vector_score DESC
        ))::int AS keyword_rank
      FROM keyword_scored ks
      ORDER BY ks.keyword_score DESC, ks.vector_score DESC
      LIMIT $3
    ),
    combined_candidates AS (
      SELECT
        COALESCE(vc.id, kc.id) AS id,
        COALESCE(vc.content, kc.content) AS content,
        COALESCE(vc.chunk_index, kc.chunk_index) AS chunk_index,
        COALESCE(vc.document_id, kc.document_id) AS document_id,
        COALESCE(vc.document_name, kc.document_name) AS document_name,
        COALESCE(vc.document_path, kc.document_path) AS document_path,
        COALESCE(vc.vector_score, kc.vector_score) AS vector_score,
        COALESCE(kc.keyword_score, 0::real) AS keyword_score,
        vc.vector_rank,
        kc.keyword_rank
      FROM vector_candidates vc
      FULL OUTER JOIN keyword_candidates kc
        ON kc.id = vc.id
    )
    SELECT
      id,
      content,
      chunk_index,
      document_id,
      document_name,
      document_path,
      vector_score AS score,
      keyword_score,
      (
        COALESCE(1.0 / ($5 + vector_rank), 0.0) +
        COALESCE(1.0 / ($5 + keyword_rank), 0.0)
      )::double precision AS hybrid_score,
      vector_rank,
      keyword_rank
    FROM combined_candidates
    ORDER BY hybrid_score DESC, score DESC
    LIMIT $4
    `,
    [
      `[${queryEmbedding.join(",")}]`,
      keywordQuery,
      candidateLimit,
      limit,
      RRF_K,
    ]
  );

  return result.rows;
}

/**
 * Searches indexed chunks with semantic retrieval or hybrid RRF fusion.
 * The default remains hybrid for API, RAG, and MCP callers.
 *
 * The returned `score` remains vector similarity for API compatibility.
 */
export async function searchDocuments(
  query: string,
  limit = 5,
  mode: SearchMode = "hybrid"
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  if (mode === "semantic") {
    return semanticSearch(queryEmbedding, limit);
  }

  return hybridSearch(queryEmbedding, buildKeywordQuery(query), limit);
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
