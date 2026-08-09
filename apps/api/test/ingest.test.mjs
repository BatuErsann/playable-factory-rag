import assert from "node:assert/strict";
import test from "node:test";

import { chunkText } from "../dist/ingest.js";

test("chunkText keeps the configured overlap between chunks", () => {
  const chunks = chunkText("abcdefghij", 4, 1);

  assert.deepEqual(chunks, ["abcd", "defg", "ghij", "j"]);
});

test("chunkText rejects an overlap as large as the chunk", () => {
  assert.throws(() => chunkText("content", 4, 4), {
    message: "Overlap must be smaller than chunk size",
  });
});
