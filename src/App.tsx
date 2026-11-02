import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { CaseList, Header, ReviewCard, Summary, Toolbar } from "./components";
import { annotation, fieldValues, text, validateDataset } from "./data";
import type { Annotation, Dataset } from "./types";
import "./App.css";

const defaultErrorTypes = [
  "numeric_value",
  "unit_loss",
  "product_code_loss",
  "code_letter_as_unit",
  "size_code_loss",
  "date_time",
  "other",
];
const emptyCases: Dataset["cases"] = [];
const sessionKey = "normalization-annotator-session";

type SavedSession = { dataset: Dataset; selectedId: string };

function restoreSession(): SavedSession | null {
  try {
    const saved = sessionStorage.getItem(sessionKey);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<SavedSession>;
    if (!candidate.dataset) return null;
    return {
      dataset: validateDataset(candidate.dataset),
      selectedId: candidate.selectedId ?? "",
    };
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export default function App() {
  const [savedSession] = useState(restoreSession);
  const [dataset, setDataset] = useState<Dataset | null>(
    savedSession?.dataset ?? null,
  );
  const [selectedId, setSelectedId] = useState(savedSession?.selectedId ?? "");
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [stage, setStage] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const cases = dataset?.cases ?? emptyCases;

  useEffect(() => {
    if (!dataset) return;
    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ dataset, selectedId }),
      );
    } catch {
      // Temporary persistence is unavailable (for example, in private browsing).
    }
  }, [dataset, selectedId]);
  const filtered = useMemo(
    () =>
      cases.filter((item) => {
        const human = annotation(item);
        const haystack = [
          item.id,
          item.source_text,
          item.prediction,
          item.reason,
          item.review_note,
        ]
          .join(" ")
          .toLowerCase();
        const reviewMatches =
          reviewFilter === "all" ||
          (reviewFilter === "reviewed"
            ? Boolean(human.judgment)
            : !human.judgment);
        const hasType =
          (Array.isArray(item.error_types) &&
            item.error_types.includes(typeFilter)) ||
          (human.error_types ?? []).includes(typeFilter);
        return (
          haystack.includes(query.toLowerCase()) &&
          reviewMatches &&
          (severity === "all" || item.severity === severity) &&
          (stage === "all" || item.error_stage === stage) &&
          (typeFilter === "all" || hasType)
        );
      }),
    [cases, query, reviewFilter, severity, stage, typeFilter],
  );
  const current =
    filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const currentIndex = filtered.findIndex((item) => item.id === current?.id);
  const sourceTypes = fieldValues(cases, "error_types");
  const availableTypes = [
    ...new Set([
      ...defaultErrorTypes,
      ...sourceTypes,
      ...(current ? (annotation(current).error_types ?? []) : []),
    ]),
  ];

  function updateAnnotation(update: Partial<Annotation>) {
    if (!current) return;
    setDataset((old) =>
      old
        ? {
            ...old,
            cases: old.cases.map((item) =>
              item.id === current.id
                ? {
                    ...item,
                    human_annotation: {
                      ...annotation(item),
                      ...update,
                      reviewed_at: update.judgment
                        ? new Date().toISOString()
                        : annotation(item).reviewed_at,
                    },
                  }
                : item,
            ),
          }
        : old,
    );
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateDataset(JSON.parse(String(reader.result)));
        if (
          cases.some((item) => annotation(item).judgment) &&
          !window.confirm("Replace the current dataset and annotations?")
        )
          return;
        setDataset(parsed);
        setSelectedId(parsed.cases[0]?.id ?? "");
        setMessage(`Imported ${parsed.cases.length} cases from ${file.name}.`);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not read this JSON file.",
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function exportData() {
    if (!dataset) return;
    const blob = new Blob([JSON.stringify(dataset, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "annotated-normalization-cases.json";
    link.click();
    URL.revokeObjectURL(url);
    sessionStorage.removeItem(sessionKey);
    setDataset(null);
    setSelectedId("");
    setMessage(
      "Annotations exported. The temporary review session was cleared.",
    );
  }

  const navigate = (offset: number) => {
    const next = filtered[currentIndex + offset];
    if (next) setSelectedId(next.id);
  };
  return (
    <main className="app-shell">
      <Header
        title={text(dataset?.title)}
        notes={text(dataset?.notes)}
        onImport={importFile}
        onExport={exportData}
      />
      {message && (
        <div className="message" role="status">
          {message}
        </div>
      )}
      {dataset ? (
        <>
          <Summary cases={cases} />
          <Toolbar
            query={query}
            setQuery={setQuery}
            reviewFilter={reviewFilter}
            setReviewFilter={setReviewFilter}
            severity={severity}
            setSeverity={setSeverity}
            stage={stage}
            setStage={setStage}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sourceTypes={sourceTypes}
            severities={fieldValues(cases, "severity")}
            stages={fieldValues(cases, "error_stage")}
          />
          {current ? (
            <section className="workspace">
              <CaseList
                items={filtered}
                selectedId={current.id}
                onSelect={setSelectedId}
              />
              <ReviewCard
                item={current}
                index={currentIndex}
                total={filtered.length}
                availableTypes={availableTypes}
                onSelect={navigate}
                onUpdate={updateAnnotation}
              />
            </section>
          ) : (
            <div className="empty">No cases match these filters.</div>
          )}
        </>
      ) : (
        <section className="empty welcome">
          <h2>Start a review session</h2>
          <p>
            Import a JSON file with a top-level <code>cases</code> array to
            begin annotating.
          </p>
        </section>
      )}
    </main>
  );
}
