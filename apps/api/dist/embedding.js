"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
const openai_1 = __importDefault(require("openai"));
/**
 * Generates the vector representation used by ingestion and semantic search.
 *
 * The input text must be a non-empty source passage or search query.
 * @returns A 1536-dimensional embedding from `text-embedding-3-small`.
 * @throws Error when the text is empty, configuration is missing, or no vector is returned.
 */
async function generateEmbedding(text) {
    if (!text.trim()) {
        throw new Error("Cannot generate an embedding for empty text");
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
    }
    const openai = new openai_1.default({ apiKey });
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
