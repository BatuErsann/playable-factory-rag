# AI Usage

AI tools were used selectively during development, primarily to discuss implementation options, review code, and troubleshoot integration issues. The project was built incrementally rather than generated from a single prompt or command. Suggestions were reviewed, tested locally, and adjusted according to the actual dataset and application behavior.

## Where AI Was Helpful

AI assistance was mainly used for:

- Discussing the project structure and backend organization
- Reviewing TypeScript and Express implementation details
- Evaluating data ingestion and chunking approaches
- Discussing RAG prompting and retrieval behavior
- Reviewing authentication and authorization flows
- Iterating on selected frontend implementation details

Some authentication patterns were adapted from previous chatbot-related work and adjusted for the requirements of this project.

## Decisions Verified Manually

### Chunking

The initial chunking strategy was not retained without testing. I inspected the corpus and compared several configurations:

- 1000 characters / 200-character overlap
- 800 characters / 150-character overlap
- 800 characters / 200-character overlap
- 700 characters / 150-character overlap
- 500 characters / 100-character overlap

Based on the document sizes and the resulting chunk distribution, I selected a baseline of 800 characters with a 150-character overlap.

### Search Threshold

The similarity threshold was tuned using actual search results. Relevant corpus-specific queries produced useful results around a similarity score of 0.4, while clearly unrelated questions produced scores closer to 0.1. For this reason, I avoided choosing an arbitrarily high threshold and treated the selected value as specific to this dataset and embedding setup.

### Grounded Answers

The RAG flow was tested with both relevant and unrelated questions. When a question was not supported by the corpus, the expected behavior was to report that there was insufficient information instead of relying on the model's general knowledge. This behavior was verified through the actual `/ask` endpoint.

### Authentication

Some authentication patterns were adapted from previous chatbot-related work. The frontend authentication flow HttpOnly cookie-based approach. Backend authentication and role-based authorization form the actual security boundary. Public registration cannot create users with the `ADMIN` role.

### MCP

The MCP implementation reuses the existing semantic search service instead of maintaining a separate retrieval implementation. The `search_documents` MCP tool calls the same `searchDocuments()` function used by the application. The tool was successfully tested with MCP Inspector.

## Validation

Changes were verified using:

- TypeScript compilation
- ESLint
- Production builds
- Postman API tests
- Direct PostgreSQL queries
- Browser tests
- Retrieval tests with corpus-specific questions
- Tests with unrelated questions
- MCP Inspector

Specific checks included:

- Verifying that every indexed chunk has an embedding vector
- Verifying that the embedding vector dimensions match the pgvector schema
- Checking the quality of semantic search results
- Verifying `USER` and `ADMIN` access restrictions
- Verifying that public registration cannot assign the `ADMIN` role
- Verifying that search activity is stored in PostgreSQL
- Verifying that MCP returns semantic retrieval results through the shared search implementation

## Development Approach

AI was used as a development tool rather than as a source of truth. Suggestions were compared against the existing code and actual runtime behavior, and they were changed whenever they did not match the corpus, security requirements, or application architecture.
