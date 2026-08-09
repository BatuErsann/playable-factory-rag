"use client";

import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";

type AdminStats = {
  documents: number;
  chunks: number;
  embeddedChunks: number;
  searches: number;
};

type AdminDocument = {
  id: number;
  name: string;
  path: string;
  status: string;
  indexed_at: string | null;
  created_at: string;
  chunk_count: number;
  embedded_chunk_count: number;
};

type DocumentsResponse = {
  documents: AdminDocument[];
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

        const [statsResponse, documentsResponse] = await Promise.all([
          fetch(`${apiUrl}/admin/stats`, {
            credentials: "include",
          }),
          fetch(`${apiUrl}/admin/documents`, {
            credentials: "include",
          }),
        ]);

        if (!statsResponse.ok) {
          throw new Error("Failed to load admin stats.");
        }

        if (!documentsResponse.ok) {
          throw new Error("Failed to load documents.");
        }

        const statsData =
          (await statsResponse.json()) as AdminStats;

        const documentsData =
          (await documentsResponse.json()) as DocumentsResponse;

        setStats(statsData);
        setDocuments(documentsData.documents);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      }
    }

    loadAdminData();
  }, []);

  return (
    <WorkspaceShell
      activePage="admin"
      requiredRole="ADMIN"
      title="Admin dashboard"
    >
      <div className="px-6 py-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">
            Overview
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Admin dashboard
          </h2>

          <p className="mt-2 text-sm text-white/40">
            Corpus health and search activity.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {stats && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Documents"
              value={stats.documents}
            />

            <StatCard
              label="Chunks"
              value={stats.chunks}
            />

            <StatCard
              label="Embedded chunks"
              value={stats.embeddedChunks}
            />

            <StatCard
              label="Searches"
              value={stats.searches}
            />
          </div>
        )}

        <div className="mt-10">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff8b00]">
              Corpus
            </p>

            <h3 className="mt-2 text-xl font-semibold text-white">
              Indexed documents
            </h3>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-white/[0.08] bg-white/[0.025]">
                  <tr className="text-xs uppercase tracking-[0.12em] text-white/30">
                    <th className="px-5 py-4 font-medium">
                      Document
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Chunks
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Embedded
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Indexed at
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-white/[0.05] last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-white/80">
                          {document.name}
                        </p>

                        <p className="mt-1 text-xs text-white/30">
                          {document.path}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                          {document.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/55">
                        {document.chunk_count}
                      </td>

                      <td className="px-5 py-4 text-sm text-white/55">
                        {document.embedded_chunk_count}
                      </td>

                      <td className="px-5 py-4 text-sm text-white/45">
                        {document.indexed_at
                          ? new Date(
                              document.indexed_at
                            ).toLocaleString()
                          : "Not indexed"}
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-white/35"
                      >
                        No documents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}