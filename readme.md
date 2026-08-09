# Playable Factory AI

Playable Factory AI is a full-stack retrieval-augmented generation (RAG) application for searching and asking questions about an internal Markdown corpus. It combines semantic search, grounded AI answers, source citations, role-based access control, an administration dashboard, and an MCP search tool in a single TypeScript monorepo.

The application is designed as a practical internal knowledge assistant: users can ask natural-language questions, while administrators can ingest documents and inspect corpus health. Answers are generated only when the indexed corpus contains sufficiently relevant context.

## Features

- Semantic document search backed by PostgreSQL and pgvector
- Grounded answers with document and chunk citations
- Markdown ingestion with per-document status and error tracking
- OpenAI embeddings and response generation
- HttpOnly cookie-based JWT authentication
- `USER` and `ADMIN` role-based authorization enforced by the API
- Tabbed admin views for indexed documents and recent searches
- Search activity logging in PostgreSQL
- Shared API contracts through `@playable/shared`
- MCP `search_documents` tool backed by the same search service as the API
- Responsive Next.js chat and administration interfaces
- Doxygen-generated source documentation

## How It Works

```text
Markdown corpus
      |
      v
Chunking (800 characters, 150-character overlap)
      |
      v
OpenAI text-embedding-3-small (1536 dimensions)
      |
      v
PostgreSQL + pgvector
      |
      +---- semantic search ----> ranked chunks
                                   |
                                   v
                           grounded RAG answer
                           with source citations
```

During ingestion, Markdown documents from `corpus/` are split into overlapping chunks. Each chunk is embedded and stored in PostgreSQL using pgvector. Documents are marked `PENDING` while being processed, `INDEXED` after success, and `FAILED` with a readable `last_error` after failure. A failed document does not stop the remaining corpus from being indexed.

A question is embedded with the same model and compared with the indexed vectors. The highest-ranked chunks above the RAG similarity threshold are passed to the response model as context. If no sufficiently relevant context is available, the API returns an insufficient-information response instead of answering from general model knowledge.

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16, pgvector |
| AI | OpenAI `text-embedding-3-small`, `gpt-4.1-mini` |
| Authentication | JWT in an HttpOnly cookie, bcrypt password hashing |
| Integration | Model Context Protocol (MCP), stdio transport |
| Documentation | Doxygen |

## Repository Layout

```text
playableFactory/
|-- apps/
|   |-- api/              Express API, RAG, ingestion, auth, and MCP
|   `-- web/              Next.js user and admin interfaces
|-- packages/
|   `-- shared/           Shared TypeScript API contracts
|-- corpus/               Markdown source documents
|-- Doxyfile              Doxygen configuration
|-- docker-compose.yml    Local PostgreSQL/pgvector service
|-- AI_USAGE.md           AI-assisted development disclosure
`-- readme.md             Project documentation
```

## Prerequisites

- Node.js 22 or another current Node.js version supported by the dependencies
- npm
- Docker Desktop or a compatible Docker environment
- An OpenAI API key
- Doxygen, when generating the source documentation

## Local Setup

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Create environment files

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Set a real `OPENAI_API_KEY` and a long random `JWT_SECRET` in `apps/api/.env`.

Default development configuration:

```dotenv
# apps/api/.env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playable_rag
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=replace-with-your-openai-api-key
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

```dotenv
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Start PostgreSQL and initialize the schema

```bash
docker compose up -d
docker cp apps/api/src/db/init.sql playable-rag-db:/tmp/init.sql
docker compose exec db psql -U postgres -d playable_rag -f /tmp/init.sql
```

The SQL script enables pgvector and creates the `users`, `documents`, `document_chunks`, and `search_logs` tables. It is safe to run again because its schema creation statements are idempotent. On API startup, backward-compatible migrations add newer fields such as `documents.last_error` when they are missing.

### 4. Create development users

```bash
npm run seed --workspace=api
```

The seed command creates local `USER` and `ADMIN` accounts for development. Review or replace the demo credentials in `apps/api/src/seed.ts` before using the application outside a local environment.

### 5. Start the application

Keep the following commands running in separate terminals from the repository root.

Backend API:

```bash
npm run dev --workspace=api
```

Frontend:

```bash
npm run dev --workspace=web
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

### 6. Ingest the corpus

Ingestion is restricted to authenticated administrators. The following example logs in, stores the HttpOnly session cookie in a temporary cookie jar, and starts ingestion:

```bash
curl -c cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@playable.com","password":"Admin123"}' http://localhost:4000/auth/login
curl -b cookies.txt -X POST http://localhost:4000/ingest
```

The endpoint keeps processing after individual document failures and returns an aggregate summary:

```json
{
  "message": "Ingestion completed",
  "total": 142,
  "succeeded": 140,
  "failed": 2
}
```

The counts depend on the current corpus. Failed documents are available through the admin documents endpoint with `status: "FAILED"` and a `last_error` message.

Delete `cookies.txt` after the local test because it contains an authenticated session cookie.

## Authentication and Authorization

Successful login sets a JWT in the `playable_factory_token` cookie. The cookie is HttpOnly, uses `SameSite=Lax` by default, and is marked Secure in production. Browser requests include credentials, and the frontend restores an existing session through `GET /auth/profile`; it never needs to read the JWT.

The backend is the authoritative security boundary:

- `USER` and `ADMIN` can access `/search` and `/ask`.
- Only `ADMIN` can access `/ingest`, `/admin/stats`, `/admin/documents`, and `/admin/search-logs`.
- Public registration always creates a `USER`; a caller cannot request the `ADMIN` role.
- Cookie authentication is preferred, with Bearer tokens retained as a fallback for tools such as Postman.

For production deployments on different sites, use HTTPS and configure `FRONTEND_URL`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, and, only when necessary, `COOKIE_DOMAIN`. `SameSite=None` requires a Secure cookie. Never combine credentialed CORS with a wildcard origin.

## API Overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Check API and database availability |
| `POST` | `/auth/register` | Public | Create a `USER` account |
| `POST` | `/auth/login` | Public | Authenticate and set the session cookie |
| `POST` | `/auth/logout` | Public | Clear the session cookie |
| `GET` | `/auth/profile` | Authenticated | Return the current user |
| `POST` | `/auth/change-password` | Authenticated | Change the current user's password |
| `POST` | `/search` | `USER`, `ADMIN` | Return semantically similar chunks |
| `POST` | `/ask` | `USER`, `ADMIN` | Return a grounded answer and citations |
| `POST` | `/ingest` | `ADMIN` | Index the corpus and return success/failure counts |
| `GET` | `/admin/stats` | `ADMIN` | Return corpus and search statistics |
| `GET` | `/admin/documents` | `ADMIN` | List documents, status, chunk counts, and `last_error` |
| `GET` | `/admin/search-logs` | `ADMIN` | Return the 20 most recent search records |

Example question request:

```bash
curl -b cookies.txt -H "Content-Type: application/json" -d '{"question":"What are the AppLovin delivery requirements?"}' http://localhost:4000/ask
```

## MCP Server

The MCP server exposes one tool:

- `search_documents`: performs semantic search over the indexed corpus, with an optional result limit between 1 and 10.

It calls the same `searchDocuments()` implementation used by the HTTP API, avoiding a separate retrieval path.

Start the stdio MCP server with:

```bash
npm run mcp --workspace=api
```

The server can then be connected to an MCP-compatible client or MCP Inspector.

## Doxygen Documentation

The repository includes a `Doxyfile` configured for the TypeScript and TSX source files. The README is used as the documentation landing page, and the generated reference includes the backend services and reusable frontend modules.

After installing Doxygen, run:

```bash
npm run docs
```

The documentation runner checks `PATH` and the standard per-user Windows installation directory. A custom installation can be selected by setting `DOXYGEN_BIN` to the full executable path.

Open `docs/generated/html/index.html` to view the generated documentation. Generated output is ignored by Git and can always be recreated from the source.

## Validation

```bash
npm run build
npm run lint --workspace=web
npm run docs
```

Useful runtime checks include:

- Login sets an HttpOnly cookie and refresh restores the session.
- Unauthenticated protected requests return `401`.
- A `USER` can use `/search` and `/ask` but receives `403` for admin routes.
- An `ADMIN` can ingest documents and access administration data.
- Indexed chunks contain 1536-dimensional embeddings.
- Corpus-backed questions return citations, while unrelated questions return an insufficient-information response.
- MCP semantic results match the shared HTTP search behavior.

## AI Usage

Development-time AI usage, manually verified decisions, and validation details are documented separately in `AI_USAGE.md`.
