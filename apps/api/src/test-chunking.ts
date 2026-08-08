import fs from "fs";
import path from "path";
import { chunkText } from "./ingest.js";

const CORPUS_PATH = path.resolve(process.cwd(), "../../corpus");

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

async function testConfig(chunkSize: number, overlap: number) {
  const files = await walkDirectory(CORPUS_PATH);

  let totalChunks = 0;

  for (const filePath of files) {
    const text = await fs.promises.readFile(filePath, "utf-8");

    const chunks = chunkText(text, chunkSize, overlap);

    totalChunks += chunks.length;
  }

  console.log({
    chunkSize,
    overlap,
    documents: files.length,
    totalChunks,
    averageChunksPerDocument: (totalChunks / files.length).toFixed(2),
  });
}

async function main() {
  await testConfig(1000, 200);
  await testConfig(800, 150);
  await testConfig(800, 200);
  await testConfig(700, 150);
  await testConfig(500, 100);
}

main().catch(console.error);