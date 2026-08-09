import { searchDocuments } from "./search.js";
import { answerQuestion } from "./rag.js";

type EvaluationCase = {
  question: string;
  expectedDocuments: string[];
};

const retrievalCases: EvaluationCase[] = [
  {
    question:
      "What is the maximum file size for an AppLovin playable, and how does it ship?",
    expectedDocuments: ["network-specs-applovin.md"],
  },
  {
    question:
      "How do I initialize the current Lumen SDK, and what happened to lumen.track?",
    expectedDocuments: ["sdk-notes-v3.md"],
  },
  {
    question: "Why are sound assets built in a separate pass?",
    expectedDocuments: [
      "build-pipeline.md",
      "incident-postmortem-2026-03.md",
    ],
  },
  {
    question:
      "What caused the March 2026 AppLovin rejections and what was fixed?",
    expectedDocuments: ["incident-postmortem-2026-03.md"],
  },
  {
    question:
      "Which languages must every playable ship with, and what is the fallback?",
    expectedDocuments: ["localization-guide.md"],
  },
];

const unanswerableQuestion =
  "What is the company vacation policy and how many paid vacation days do employees receive?";

function matchesExpectedDocument(
  actualDocumentName: string,
  expectedDocuments: string[]
): boolean {
  return expectedDocuments.some(
    (expected) =>
      actualDocumentName.toLowerCase() === expected.toLowerCase()
  );
}

async function runEvaluation(): Promise<void> {
  let top1Hits = 0;
  let top3Hits = 0;

  console.log("\nRetrieval Evaluation\n");

  for (const testCase of retrievalCases) {
    const results = await searchDocuments(testCase.question, 5);

    const top1 = results[0];
    const top3 = results.slice(0, 3);

    const top1Hit =
      top1 !== undefined &&
      matchesExpectedDocument(
        top1.document_name,
        testCase.expectedDocuments
      );

    const top3Hit = top3.some((result) =>
      matchesExpectedDocument(
        result.document_name,
        testCase.expectedDocuments
      )
    );

    if (top1Hit) {
      top1Hits += 1;
    }

    if (top3Hit) {
      top3Hits += 1;
    }

    console.log(`Question: ${testCase.question}`);
    console.log(
      `Expected: ${testCase.expectedDocuments.join(", ")}`
    );
    console.log(
      `Top 1: ${top1?.document_name ?? "No result"} ${
        top1Hit ? "✓" : "✗"
      }`
    );
    console.log(
      `Top 3: ${top3
        .map((result) => result.document_name)
        .join(", ")} ${top3Hit ? "✓" : "✗"}`
    );
    console.log("");
  }

  const total = retrievalCases.length;
  const top1Accuracy = (top1Hits / total) * 100;
  const top3Accuracy = (top3Hits / total) * 100;

  console.log("Retrieval Summary");
  console.log("-----------------");
  console.log(
    `Top-1 accuracy: ${top1Hits}/${total} (${top1Accuracy.toFixed(
      1
    )}%)`
  );
  console.log(
    `Top-3 accuracy: ${top3Hits}/${total} (${top3Accuracy.toFixed(
      1
    )}%)`
  );

  console.log("\nUnanswerable Question Test");
  console.log("--------------------------");

  const unanswerableResult = await answerQuestion(
    unanswerableQuestion
  );

  const refused =
    unanswerableResult.citations.length === 0 &&
    unanswerableResult.answer.toLowerCase().includes(
      "could not find enough information"
    );

  console.log(`Question: ${unanswerableQuestion}`);
  console.log(`Answer: ${unanswerableResult.answer}`);
  console.log(
    `Citations: ${unanswerableResult.citations.length}`
  );
  console.log(`Refusal behavior: ${refused ? "✓ PASS" : "✗ FAIL"}`);

  console.log("\nEvaluation complete.");
}

runEvaluation().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});