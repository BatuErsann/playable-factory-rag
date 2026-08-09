"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ingest_js_1 = require("./ingest.js");
const CORPUS_PATH = path_1.default.resolve(process.cwd(), "../../corpus");
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
async function testConfig(chunkSize, overlap) {
    const files = await walkDirectory(CORPUS_PATH);
    let totalChunks = 0;
    for (const filePath of files) {
        const text = await fs_1.default.promises.readFile(filePath, "utf-8");
        const chunks = (0, ingest_js_1.chunkText)(text, chunkSize, overlap);
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
