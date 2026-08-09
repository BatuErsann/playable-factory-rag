import OpenAI from "openai";

/**
 * Generates the vector representation used by ingestion and semantic search.
 *
 * The input text must be a non-empty source passage or search query.
 * @returns A 1536-dimensional embedding from `text-embedding-3-small`.
 * @throws Error when the text is empty, configuration is missing, or no vector is returned.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate an embedding for empty text");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    // This model returns 1536 dimensions, matching document_chunks.embedding.
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned no embedding data");
  }

  return embedding;
}
