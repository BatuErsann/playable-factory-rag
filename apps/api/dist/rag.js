"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerQuestion = answerQuestion;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const search_js_1 = require("./search.js");
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
const MIN_SIMILARITY = 0.25;
async function answerQuestion(question) {
    const results = await (0, search_js_1.searchDocuments)(question, 5);
    const relevantResults = results.filter((result) => result.score >= MIN_SIMILARITY);
    if (relevantResults.length === 0) {
        return {
            answer: "I could not find enough information in the corpus to answer this question.",
            citations: []
        };
    }
    const context = relevantResults
        .map((result, index) => {
        return `
[${index + 1}]
Document: ${result.document_name}
Path: ${result.document_path}

${result.content}
`;
    })
        .join("\n");
    const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: `
You are answering questions using only the provided corpus context.

Rules:
- Only use information contained in the context.
- Do not use outside knowledge.
- If the context does not contain enough information, say that you cannot answer from the provided corpus.
- Cite claims using [1], [2], etc.
- Do not invent citations.

Question:
${question}

Context:
${context}
`
    });
    return {
        answer: response.output_text,
        citations: relevantResults.map((result, index) => ({
            id: index + 1,
            documentName: result.document_name,
            documentPath: result.document_path,
            chunkIndex: result.chunk_index,
            score: result.score
        }))
    };
}
