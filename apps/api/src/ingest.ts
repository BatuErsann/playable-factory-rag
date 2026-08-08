import fs from "fs";
import path from "path";
import { db } from "./db.js";

import { generateEmbedding } from "./embedding.js";

const CORPUS_PATH = path.resolve(process.cwd(), "../../corpus");


//overlapping 0-999  then  800-1799 ... 
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 150
): string[] {
//err handling for overlap greater than chunk size
    if (overlap >= chunkSize) {
  throw new Error("Overlap must be smaller than chunk size");
}
  const chunks: string[] = [];

  const step = chunkSize - overlap;

  for (let i = 0; i < text.length; i += step) {
    const chunk = text.slice(i, i + chunkSize);

    chunks.push(chunk);
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
export async function ingestDocuments() {
  const files = await walkDirectory(CORPUS_PATH);

  console.log(`Found ${files.length} markdown files`);

  for (const filePath of files) {
    const relativePath = path.relative(CORPUS_PATH, filePath);
    const fileName = path.basename(filePath);

    
    const fileContent = await fs.promises.readFile(filePath, "utf-8");

   
    const documentResult = await db.query(
      `
      INSERT INTO documents (name, path, status)
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (path)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = 'PENDING'
      RETURNING id
      `,
      [fileName, relativePath]
    );

    const documentId = documentResult.rows[0].id;


    const chunks = chunkText(fileContent);

    await db.query(
      `DELETE FROM document_chunks WHERE document_id = $1`,
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
        [
          documentId,
          i,
          chunk,
          `[${embedding.join(",")}]`
        ]
      );
    }

    // 7. Document tamamlandı
    await db.query(
      `
      UPDATE documents
      SET status = 'INDEXED',
          indexed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [documentId]
    );
  }

  console.log("Documents and embeddings saved to database");

  console.log("Documents saved to database");
}