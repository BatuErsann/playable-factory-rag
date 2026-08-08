import fs from "fs";
import path from "path";
import { db } from "./db.js";

const CORPUS_PATH = path.resolve(process.cwd(), "../../corpus");



function chunkText(text: string, chunkSize = 1000): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
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
    DO UPDATE SET name = EXCLUDED.name
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
    await db.query(
      `
      INSERT INTO document_chunks (document_id, chunk_index, content)
      VALUES ($1, $2, $3)
      `,
      [documentId, i, chunks[i]]
    );
  }

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

  console.log("Documents saved to database");
}