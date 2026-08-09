import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { searchDocuments } from "./search.js";

function createMcpServer() {
  const server = new McpServer({
    name: "playable-factory-rag",
    version: "1.0.0",
  });

  server.registerTool(
    "search_documents",
    {
      description:
        "Search the indexed Playable Factory corpus using semantic vector search.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
    async ({ query, limit }) => {
      const results = await searchDocuments(query, limit ?? 5);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

serveStdio(() => createMcpServer());