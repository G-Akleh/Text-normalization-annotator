import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { CaseList, Header, ReviewCard, Summary, Toolbar } from "./components";
import { annotation, fieldValues, text, validateDataset } from "./data";
import type { Annotation, Dataset } from "./types";
import "./App.css";

const emptyCases: Dataset["cases"] = [];
const sessionKey = "normalization-annotator-session";
const maxSessionBytes = 5 * 1024 * 1024;
const maxSessionLabel = "5 MB";

type SavedSession = { dataset: Dataset; selectedId: string };
type Message = { text: string; kind: "info" | "error" };

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
  const [message, setMessage] = useState<Message | null>(null);
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

  const updateAnnotation = useCallback(
    (update: Partial<Annotation>) => {
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
                          : update.judgment === undefined &&
                              "skipped_at" in update
                            ? undefined
                            : annotation(item).reviewed_at,
                      },
                    }
                  : item,
              ),
            }
          : old,
      );
    },
    [current],
  );

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxSessionBytes) {
      setMessage({
        text: `Import a JSON file no larger than ${maxSessionLabel}.`,
        kind: "error",
      });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateDataset(JSON.parse(String(reader.result)));
        // sessionStorage stores DOMStrings (UTF-16), not the file's byte stream.
        if (
          JSON.stringify({ dataset: parsed, selectedId: "" }).length * 2 >
          maxSessionBytes
        )
          throw new Error(
            `This dataset is too large for the ${maxSessionLabel} browser session limit.`,
          );
        if (
          cases.some((item) => annotation(item).judgment) &&
          !window.confirm("Replace the current dataset and annotations?")
        )
          return;
        setDataset(parsed);
        setSelectedId(parsed.cases[0]?.id ?? "");
        setMessage({
          text: `Imported ${parsed.cases.length} cases from ${file.name}.`,
          kind: "info",
        });
      } catch (error) {
        setMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not read this JSON file.",
          kind: "error",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function exportData() {
    if (!dataset) {
      setMessage({
        text: "Import a JSON file before exporting annotations.",
        kind: "error",
      });
      return;
    }
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
    setMessage({
      text: "Annotations exported. The temporary review session was cleared.",
      kind: "info",
    });
  }

  const navigate = useCallback(
    (offset: number) => {
      const next = filtered[currentIndex + offset];
      if (next) setSelectedId(next.id);
    },
    [currentIndex, filtered],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        navigate(-1);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        navigate(1);
        return;
      }
      if (!current || event.ctrlKey || event.metaKey || event.altKey) return;
      const shortcuts: Record<string, Annotation["judgment"]> = {
        a: "correct",
        s: "error",
        d: "acceptable_alternative",
      };
      const judgment = shortcuts[event.key.toLowerCase()];
      if (judgment) {
        event.preventDefault();
        updateAnnotation({ judgment, skipped_at: undefined });
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        updateAnnotation({
          judgment: undefined,
          skipped_at: new Date().toISOString(),
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, currentIndex, filtered, navigate, updateAnnotation]);
  return (
    <main className="app-shell">
      <Header
        title={text(dataset?.title)}
        notes={text(dataset?.notes)}
        onImport={importFile}
        onExport={exportData}
      />
      {message && (
        <div
          className={`message ${message.kind}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
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
          <label className="button welcome-import">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={importFile}
              hidden
            />
          </label>
          <p className="upload-limit">Maximum file size: {maxSessionLabel}.</p>
        </section>
      )}
    </main>
  );
}
