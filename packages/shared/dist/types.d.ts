export interface Citation {
    id: number;
    documentName: string;
    documentPath: string;
    chunkIndex: number;
    score: number;
    passage: string;
}
export interface AskResponse {
    question: string;
    answer: string;
    citations: Citation[];
    message?: string;
}
export interface AdminStats {
    documents: number;
    chunks: number;
    embeddedChunks: number;
    searches: number;
}
export interface AdminDocument {
    id: number;
    name: string;
    path: string;
    status: string;
    indexed_at: string | null;
    created_at: string;
    chunk_count: number;
    embedded_chunk_count: number;
}
