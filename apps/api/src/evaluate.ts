import { answerQuestion } from "./rag.js";
import {
  searchDocuments,
  type SearchMode,
} from "./search.js";

type EvaluationCase = {
  question: string;
  expectedDocuments: string[];
};

type RetrievalMetrics = {
  top1Accuracy: number;
  recallAt3: number;
  meanReciprocalRank: number;
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

async function evaluateRetrieval(
  mode: SearchMode
): Promise<RetrievalMetrics> {
  let top1Hits = 0;
  let recallAt3Total = 0;
  let reciprocalRankTotal = 0;

  console.log(`\n${mode.toUpperCase()} retrieval\n`);

  for (const testCase of retrievalCases) {
    const results = await searchDocuments(testCase.question, 5, mode);
    const top1 = results[0];
    const top3DocumentNames = new Set(
      results.slice(0, 3).map((result) => result.document_name.toLowerCase())
    );

    const top1Hit =
      top1 !== undefined &&
      matchesExpectedDocument(top1.document_name, testCase.expectedDocuments);

    const matchedExpectedDocuments = testCase.expectedDocuments.filter(
      (expected) => top3DocumentNames.has(expected.toLowerCase())
    ).length;
    const recallAt3 =
      matchedExpectedDocuments / testCase.expectedDocuments.length;

    const firstRelevantIndex = results.findIndex((result) =>
      matchesExpectedDocument(result.document_name, testCase.expectedDocuments)
    );
    const reciprocalRank =
      firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;

    if (top1Hit) {
      top1Hits += 1;
    }

    recallAt3Total += recallAt3;
    reciprocalRankTotal += reciprocalRank;

    console.log(`Question: ${testCase.question}`);
    console.log(`Expected: ${testCase.expectedDocuments.join(", ")}`);
    console.log(
      `Top 3: ${results
        .slice(0, 3)
        .map((result) => result.document_name)
        .join(", ")}`
    );
    console.log(
      `Top-1: ${top1Hit ? "PASS" : "FAIL"} | Recall@3: ${recallAt3.toFixed(2)} | RR: ${reciprocalRank.toFixed(2)}\n`
    );
  }

  return {
    top1Accuracy: top1Hits / retrievalCases.length,
    recallAt3: recallAt3Total / retrievalCases.length,
    meanReciprocalRank: reciprocalRankTotal / retrievalCases.length,
  };
}

function printComparison(
  semantic: RetrievalMetrics,
  hybrid: RetrievalMetrics
): void {
  console.log("\nRetrieval comparison");
  console.log("--------------------");
  console.log(
    `Top-1 accuracy  semantic=${semantic.top1Accuracy.toFixed(2)} hybrid=${hybrid.top1Accuracy.toFixed(2)} delta=${(hybrid.top1Accuracy - semantic.top1Accuracy).toFixed(2)}`
  );
  console.log(
    `Recall@3       semantic=${semantic.recallAt3.toFixed(2)} hybrid=${hybrid.recallAt3.toFixed(2)} delta=${(hybrid.recallAt3 - semantic.recallAt3).toFixed(2)}`
  );
  console.log(
    `MRR            semantic=${semantic.meanReciprocalRank.toFixed(2)} hybrid=${hybrid.meanReciprocalRank.toFixed(2)} delta=${(hybrid.meanReciprocalRank - semantic.meanReciprocalRank).toFixed(2)}`
  );
}

async function runEvaluation(): Promise<void> {
  const semanticMetrics = await evaluateRetrieval("semantic");
  const hybridMetrics = await evaluateRetrieval("hybrid");

  printComparison(semanticMetrics, hybridMetrics);

  console.log("\nUnanswerable question test");
  console.log("--------------------------");

  const unanswerableResult = await answerQuestion(unanswerableQuestion);
  const refused =
    unanswerableResult.citations.length === 0 &&
    unanswerableResult.answer
      .toLowerCase()
      .includes("could not find enough information");

  console.log(`Question: ${unanswerableQuestion}`);
  console.log(`Answer: ${unanswerableResult.answer}`);
  console.log(`Citations: ${unanswerableResult.citations.length}`);
  console.log(`Refusal behavior: ${refused ? "PASS" : "FAIL"}`);
  console.log("\nEvaluation complete.");
}

runEvaluation().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
