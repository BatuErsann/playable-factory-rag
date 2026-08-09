"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminDocument, AdminStats } from "@playable/shared";

import { WorkspaceShell } from "@/components/workspace-shell";

type DocumentsResponse = {
  documents: AdminDocument[];
};

type SearchLog = {
  id: number;
  query: string;
  result_count: number;
  created_at: string;
  username: string | null;
  email: string | null;
};

type SearchLogsResponse = {
  searches: SearchLog[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [searches, setSearches] = useState<SearchLog[]>([]);
  const [error, setError] = useState("");
  const [ingestMessage, setIngestMessage] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "searches">(
    "documents"
  );

  const loadAdminData = useCallback(async () => {
    try {
      setError("");

      const [
        statsResponse,
        documentsResponse,
        searchLogsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, {
          credentials: "include",
        }),
        fetch(`${API_URL}/admin/documents`, {
          credentials: "include",
        }),
        fetch(`${API_URL}/admin/search-logs`, {
          credentials: "include",
        }),
      ]);

      if (!statsResponse.ok) {
        throw new Error("Failed to load admin stats.");
      }

      if (!documentsResponse.ok) {
        throw new Error("Failed to load documents.");
      }

      if (!searchLogsResponse.ok) {
        throw new Error("Failed to load search analytics.");
      }

      const statsData = (await statsResponse.json()) as AdminStats;
      const documentsData =
        (await documentsResponse.json()) as DocumentsResponse;
      const searchLogsData =
        (await searchLogsResponse.json()) as SearchLogsResponse;

      setStats(statsData);
      setDocuments(documentsData.documents);
      setSearches(searchLogsData.searches);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function handleReindex() {
    if (isIngesting) {
      return;
    }

    setIsIngesting(true);
    setError("");
    setIngestMessage("");

    try {
      const response = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        let message = "Failed to synchronize the corpus.";

        try {
          const data = (await response.json()) as {
            message?: string;
            error?: string;
          };

          message = data.message ?? data.error ?? message;
        } catch {
          // Keep the default error message if the response is not JSON.
        }

        throw new Error(message);
      }

      setIngestMessage("Corpus synchronized successfully.");
      await loadAdminData();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while synchronizing the corpus."
      );
    } finally {
      setIsIngesting(false);
    }
  }

  return (
    <WorkspaceShell
      activePage="admin"
      requiredRole="ADMIN"
      title="Dashboard"
    >
      <div className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">
                Overview
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                Dashboard
              </h2>

              <p className="mt-2 text-sm text-white/40">
                Corpus health, ingestion status, and search activity.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReindex}
              disabled={isIngesting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#ff8b00] px-5 text-sm font-semibold text-white transition hover:bg-[#ff9d26] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isIngesting ? "Syncing..." : "Sync corpus"}
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {ingestMessage && (
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              {ingestMessage}
            </div>
          )}

          {stats && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Documents" value={stats.documents} />
              <StatCard label="Chunks" value={stats.chunks} />
              <StatCard
                label="Embedded chunks"
                value={stats.embeddedChunks}
              />
              <StatCard label="Searches" value={stats.searches} />
            </div>
          )}

          <div className="mt-10">
            <div
              role="tablist"
              aria-label="Admin data views"
              className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.025] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "documents"}
                onClick={() => setActiveTab("documents")}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition sm:px-5 ${
                  activeTab === "documents"
                    ? "bg-[#ff8b00] text-white shadow-[0_8px_24px_rgba(255,139,0,0.16)]"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                }`}
              >
                Indexed documents
                <span className="ml-2 text-xs opacity-60">
                  {documents.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "searches"}
                onClick={() => setActiveTab("searches")}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition sm:px-5 ${
                  activeTab === "searches"
                    ? "bg-[#ff8b00] text-white shadow-[0_8px_24px_rgba(255,139,0,0.16)]"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                }`}
              >
                Recent searches
                <span className="ml-2 text-xs opacity-60">
                  {searches.length}
                </span>
              </button>
            </div>

            <div className="mt-4">
              {activeTab === "documents" ? (
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] xl:h-[610px]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">
                    Corpus
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Indexed documents
                  </h3>
                  <p className="mt-1 text-xs text-white/35">
                    Files currently available to semantic search.
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs text-white/45">
                  {documents.length} files
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0e1b31]">
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                      <th className="px-5 py-3.5 font-medium">Document</th>
                      <th className="px-4 py-3.5 font-medium">Status</th>
                      <th className="px-4 py-3.5 font-medium">Embedded</th>
                      <th className="px-5 py-3.5 font-medium">Indexed at</th>
                    </tr>
                  </thead>

                  <tbody>
                    {documents.map((document) => (
                      <tr
                        key={document.id}
                        className="border-b border-white/[0.05] last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <p className="max-w-[220px] truncate text-sm font-medium text-white/80">
                            {document.name}
                          </p>
                          <p className="mt-1 max-w-[220px] truncate text-[11px] text-white/30">
                            {document.path}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge status={document.status} />
                        </td>

                        <td className="px-4 py-4 text-xs text-white/50">
                          {document.embedded_chunk_count} / {document.chunk_count}
                        </td>

                        <td className="px-5 py-4 text-xs text-white/40">
                          {document.indexed_at
                            ? new Date(document.indexed_at).toLocaleString()
                            : "Not indexed"}
                        </td>
                      </tr>
                    ))}

                    {documents.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-12 text-center text-sm text-white/35"
                        >
                          No documents found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              ) : (
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] xl:h-[610px]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">
                    Search analytics
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Recent searches
                  </h3>
                  <p className="mt-1 text-xs text-white/35">
                    Latest queries submitted through search and RAG.
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs text-white/45">
                  Latest {searches.length}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0e1b31]">
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                      <th className="px-5 py-3.5 font-medium">Query</th>
                      <th className="px-4 py-3.5 font-medium">User</th>
                      <th className="px-4 py-3.5 font-medium">Results</th>
                      <th className="px-5 py-3.5 font-medium">Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {searches.map((search) => (
                      <tr
                        key={search.id}
                        className="border-b border-white/[0.05] last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <p className="max-w-[220px] truncate text-sm text-white/75">
                            {search.query}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-[150px] truncate text-xs text-white/60">
                            {search.username ?? "Unknown"}
                          </p>
                          <p className="mt-1 max-w-[150px] truncate text-[10px] text-white/30">
                            {search.email ?? "No email"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-white/50">
                            {search.result_count}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-white/40">
                          {new Date(search.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}

                    {searches.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-12 text-center text-sm text-white/35"
                        >
                          No search activity yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();

  const className =
    normalizedStatus === "INDEXED"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : normalizedStatus === "FAILED"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : "border-amber-400/20 bg-amber-400/10 text-amber-300";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs ${className}`}
    >
      {status}
    </span>
  );
}
