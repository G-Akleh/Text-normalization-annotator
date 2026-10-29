import type { Annotation, Case, Dataset } from "./types";

export const annotation = (item: Case): Annotation =>
  item.human_annotation ?? {};
export const text = (value: unknown) =>
  typeof value === "string" ? value : "";

export const fieldValues = (items: Case[], name: string) =>
  [
    ...new Set(
      items.flatMap((item) =>
        Array.isArray(item[name])
          ? (item[name] as string[])
          : item[name]
            ? [String(item[name])]
            : [],
      ),
    ),
  ].sort();

export const isDataset = (value: unknown): value is Dataset =>
  Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as Dataset).cases),
  );

export const validateDataset = (value: unknown): Dataset => {
  if (!isDataset(value))
    throw new Error('The file must contain a top-level "cases" array.');
  const ids = value.cases
    .map((item) => item?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id.trim()));
  if (ids.length !== value.cases.length)
    throw new Error("Every case needs a usable string ID.");
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`Duplicate case ID: ${duplicate}`);
  return value;
};
