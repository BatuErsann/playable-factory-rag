import fs from "fs";
import path from "path";

import { db } from "./db.js";
import { generateEmbedding } from "./embedding.js";

const CORPUS_PATH = path.resolve(process.cwd(), "../../corpus");

export type IngestionSummary = {
  total: number;
  succeeded: number;
  failed: number;
};

function readableError(error: unknown): string {
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
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 150
): string[] {
  if (overlap >= chunkSize) {
    throw new Error("Overlap must be smaller than chunk size");
  }

  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

async function walkDirectory(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

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
export async function ingestDocuments(): Promise<IngestionSummary> {
  const files = await walkDirectory(CORPUS_PATH);
  let succeeded = 0;
  let failed = 0;

  console.log(`Found ${files.length} markdown files`);

  for (const filePath of files) {
    const relativePath = path.relative(CORPUS_PATH, filePath);
    const fileName = path.basename(filePath);
    let documentId: number | undefined;

    try {
      const documentResult = await db.query<{ id: number }>(
        `
        INSERT INTO documents (name, path, status, last_error)
        VALUES ($1, $2, 'PENDING', NULL)
        ON CONFLICT (path)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = 'PENDING',
          last_error = NULL
        RETURNING id
        `,
        [fileName, relativePath]
      );

      documentId = documentResult.rows[0]?.id;
      if (documentId === undefined) {
        throw new Error("Document record was not created");
      }

      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      const chunks = chunkText(fileContent);

      await db.query(
        "DELETE FROM document_chunks WHERE document_id = $1",
        [documentId]
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        await db.query(
          `
          INSERT INTO document_chunks (
            document_id,
            chunk_index,
            content,
            embedding
          )
          VALUES ($1, $2, $3, $4::vector)
          `,
          [documentId, i, chunk, `[${embedding.join(",")}]`]
        );
      }

      await db.query(
        `
        UPDATE documents
        SET status = 'INDEXED',
            indexed_at = CURRENT_TIMESTAMP,
            last_error = NULL
        WHERE id = $1
        `,
        [documentId]
      );

      succeeded += 1;
    } catch (error) {
      failed += 1;
      const errorMessage = readableError(error);

      console.error(`Failed to ingest ${relativePath}: ${errorMessage}`);

      if (documentId !== undefined) {
        try {
          await db.query(
            `
            UPDATE documents
            SET status = 'FAILED',
                last_error = $2
            WHERE id = $1
            `,
            [documentId, errorMessage]
          );
        } catch (statusError) {
          console.error(
            `Failed to persist ingestion error for ${relativePath}: ${readableError(statusError)}`
          );
        }
      }
    }
  }

  const summary: IngestionSummary = {
    total: files.length,
    succeeded,
    failed,
  };

  console.log(
    `Ingestion finished: ${summary.succeeded} succeeded, ${summary.failed} failed`
  );

  return summary;
}
