"use client";

import { FormEvent, useState } from "react";
import type { AskResponse, Citation } from "@playable/shared";

import { WorkspaceShell } from "@/components/workspace-shell";

const suggestions = [
  "What are the AppLovin delivery requirements?",
  "Explain the current Lumen SDK setup",
  "Why are audio assets built separately?",
];

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isLoading) {
      return;
    }

    setSubmittedQuestion(trimmedQuestion);
    setQuestion("");

    setAnswer("");
    setCitations([]);
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            question: trimmedQuestion,
          }),
        }
      );

      const data = (await response.json()) as AskResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Failed to get an answer.");
      }

      setAnswer(data.answer);
      setCitations(data.citations ?? []);
    } catch (error) {
      console.error("Ask request failed:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while asking the question."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function useSuggestion(suggestion: string) {
    setQuestion(suggestion);
  }

  return (
    <WorkspaceShell activePage="chat" title="Chat">
      <div className="flex h-[calc(100vh-73px)] min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {!submittedQuestion && !answer && (
              <div className="py-16 text-center sm:py-24">
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                  What can I help you find?
                </h1>

                <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/45">
                  Ask questions about the indexed corpus and get grounded
                  answers with citations to the source documents.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => useSuggestion(suggestion)}
                      className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-xs text-white/48 transition hover:bg-white/[0.07] hover:text-white/70"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {submittedQuestion && (
              <div className="mb-6 flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#ff8b00] px-4 py-3 text-sm leading-6 text-white">
                  {submittedQuestion}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.035] px-5 py-4">
                  <p className="text-sm text-white/50">
                    Searching the corpus...
                  </p>
                </div>
              </div>
            )}

            {answer && !isLoading && (
              <div className="flex justify-start">
                <div className="w-full max-w-[90%]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                    Playable Factory AI
                  </p>

                  <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.035] p-6">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">
                      {answer}
                    </p>
                  </div>

                  {citations.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                        Sources
                      </p>

                      <div className="space-y-2">
                        {citations.map((citation) => (
                          <div
                            key={`${citation.id}-${citation.documentPath}-${citation.chunkIndex}`}
                            className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white/80">
                                  [{citation.id}] {citation.documentName}
                                </p>

                                <p className="mt-1 break-all text-xs text-white/35">
                                  {citation.documentPath}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/40">
                                {citation.score.toFixed(3)}
                              </span>
                            </div>

                            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/10 p-3">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                                Relevant passage
                              </p>

                              <p className="whitespace-pre-wrap text-xs leading-6 text-white/55">
                                {citation.passage}
                              </p>
                            </div>

                            <p className="mt-3 text-[10px] text-white/30">
                              Chunk {citation.chunkIndex}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.05] bg-[#09152a] px-5 pb-6 pt-4 sm:px-8">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-[#6e91b5]/45 bg-[#182945] p-2 pl-5 shadow-[0_18px_55px_rgba(0,0,0,0.22)]"
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about your corpus…"
              rows={1}
              disabled={isLoading}
              className="min-h-11 flex-1 resize-none bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/32 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              aria-label="Send message"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ff8b00] text-white transition hover:bg-[#ff9d26] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <span className="text-xs">...</span>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  aria-hidden="true"
                >
                  <path
                    d="m5 12 14-7-4.5 14-3-5.5L5 12Z"
                    strokeLinejoin="round"
                  />
                  <path d="m11.5 13.5 3-3" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-2 text-center text-[10px] text-white/22">
            Grounded answers can still make mistakes. Verify important details.
          </p>
        </div>
      </div>
    </WorkspaceShell>
  );
}