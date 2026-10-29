import type { Judgment } from "./types";

export const judgments: Judgment[] = [
  "correct",
  "error",
  "acceptable_alternative",
];
export const judgmentLabels: Record<Judgment, string> = {
  correct: "Correct",
  error: "Semantic error",
  acceptable_alternative: "Acceptable alternative",
};
