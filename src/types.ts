export type RecordValue = Record<string, unknown>;

export type Judgment = "correct" | "error" | "acceptable_alternative";

export type Annotation = {
  judgment?: Judgment;
  error_types?: string[];
  comment?: string;
  reviewed_at?: string;
};

export type Case = RecordValue & {
  id: string;
  source_text?: string;
  prediction?: string;
  human_annotation?: Annotation;
};

export type Dataset = RecordValue & { cases: Case[] };
