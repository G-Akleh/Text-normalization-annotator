import type { ChangeEvent, ReactNode } from "react";
import type { Annotation, Case, Judgment } from "./types";
import { annotation, text } from "./data";
import { judgmentLabels, judgments } from "./labels";

export function Header({
  title,
  notes,
  onImport,
  onExport,
}: {
  title: string;
  notes: string;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">TEXT NORMALIZATION REVIEWER</span>
        <h1>{title || "Normalization review"}</h1>
        <p>
          {notes ||
            "Import a JSON dataset to compare model output and record human annotations."}
        </p>
      </div>
      <div className="file-actions">
        <label className="button secondary">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={onImport}
            hidden
          />
        </label>
        <button className="button" onClick={onExport} disabled={!title}>
          Export annotations
        </button>
      </div>
    </header>
  );
}

export function Summary({ cases }: { cases: Case[] }) {
  const reviewed = cases.filter((item) => annotation(item).judgment);
  const count = (judgment: Judgment) =>
    reviewed.filter((item) => annotation(item).judgment === judgment).length;
  return (
    <section className="stats">
      <Stat value={cases.length} label="Total cases" />
      <Stat value={reviewed.length} label="Reviewed" />
      <Stat value={cases.length - reviewed.length} label="Unreviewed" />
      <Stat
        value={`${count("error")} / ${count("correct")} / ${count("acceptable_alternative")}`}
        label="Error / correct / alternative"
      />
    </section>
  );
}

export function Toolbar({
  query,
  setQuery,
  reviewFilter,
  setReviewFilter,
  severity,
  setSeverity,
  stage,
  setStage,
  typeFilter,
  setTypeFilter,
  sourceTypes,
  severities,
  stages,
}: {
  query: string;
  setQuery: (v: string) => void;
  reviewFilter: string;
  setReviewFilter: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  stage: string;
  setStage: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  sourceTypes: string[];
  severities: string[];
  stages: string[];
}) {
  return (
    <section className="toolbar">
      <label className="search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cases by ID, text, reason, note"
        />
      </label>
      <Filter
        label="Review status"
        value={reviewFilter}
        setValue={setReviewFilter}
        options={[
          ["all", "All cases"],
          ["reviewed", "Reviewed"],
          ["unreviewed", "Unreviewed"],
        ]}
      />
      <Filter
        label="Severity"
        value={severity}
        setValue={setSeverity}
        options={[["all", "All severities"], ...severities.map((x) => [x, x])]}
      />
      <Filter
        label="Stage"
        value={stage}
        setValue={setStage}
        options={[["all", "All stages"], ...stages.map((x) => [x, x])]}
      />
      <Filter
        label="Source error type"
        value={typeFilter}
        setValue={setTypeFilter}
        options={[["all", "All types"], ...sourceTypes.map((x) => [x, x])]}
      />
    </section>
  );
}

export function CaseList({
  items,
  selectedId,
  onSelect,
}: {
  items: Case[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="case-list">
      <div className="list-title">
        <b>Cases</b>
        <span>{items.length} shown</span>
      </div>
      {items.map((item, index) => {
        const judgment = annotation(item).judgment;
        return (
          <button
            key={item.id}
            className={`case-row ${judgment ?? "unreviewed"} ${item.id === selectedId ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span>{index + 1}</span>
            <div>
              <strong>{item.id}</strong>
              <small>
                {text(item.severity) || "unlabeled"} ·{" "}
                {judgment
                  ? judgmentLabels[judgment]
                  : annotation(item).skipped_at
                    ? "Skipped"
                    : "Unreviewed"}
              </small>
            </div>
          </button>
        );
      })}
    </aside>
  );
}

export function ReviewCard({
  item,
  index,
  total,
  onSelect,
  onUpdate,
}: {
  item: Case;
  index: number;
  total: number;
  onSelect: (offset: number) => void;
  onUpdate: (update: Partial<Annotation>) => void;
}) {
  const current = annotation(item);
  const reference = text(item.reference_text) || text(item.gold_text);
  return (
    <article className="review-card">
      <div className="card-header">
        <div>
          <div className="case-id">{item.id}</div>
          <div className="chips">
            {[item.family, item.severity, item.error_stage]
              .filter(Boolean)
              .map((value) => (
                <span className="chip" key={String(value)}>
                  {String(value)}
                </span>
              ))}
            {!current.judgment && (
              <span className="chip pending">Unreviewed</span>
            )}
          </div>
        </div>
        <div className="navigation">
          <span>
            Case {index + 1} / {total}
          </span>
          <button onClick={() => onSelect(-1)} disabled={index <= 0}>
            Previous
          </button>
          <button onClick={() => onSelect(1)} disabled={index >= total - 1}>
            Next
          </button>
        </div>
      </div>
      <div className="comparison">
        <Panel title="Source text" value={text(item.source_text)} />
        <Panel title="Pipeline answer" value={text(item.prediction)} />
        <Panel title="Reference text" value={reference} muted={!reference} />
      </div>
      <section className="annotation">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ANNOTATOR DECISION</span>
            <span className="shortcut-hint">
              Hotkeys: A correct · S error · D alternative · F skip · ↑/↓ cases
            </span>
          </div>
          {current.judgment && <span className="reviewed-mark">Reviewed</span>}
        </div>
        <div className="judgments">
          {judgments.map((judgment) => (
            <button
              key={judgment}
              className={`judgment ${current.judgment === judgment ? `selected ${judgment}` : ""}`}
              onClick={() =>
                onUpdate({
                  judgment:
                    current.judgment === judgment ? undefined : judgment,
                  skipped_at: undefined,
                })
              }
            >
              {judgmentLabels[judgment]}
            </button>
          ))}
          <button
            className={`judgment skip ${current.skipped_at ? "selected" : ""}`}
            onClick={() =>
              onUpdate({
                judgment: undefined,
                skipped_at: current.skipped_at
                  ? undefined
                  : new Date().toISOString(),
              })
            }
          >
            Skip
          </button>
        </div>
        <div className="fields">
          <label>
            Annotation comment
            <textarea
              value={current.comment ?? ""}
              onChange={(event) => onUpdate({ comment: event.target.value })}
              placeholder="Optional rationale for this decision"
            />
          </label>
        </div>
      </section>
      <details className="details">
        <summary>Source details & diagnostics</summary>
        <div className="diagnostics">
          <DiagnosticLine label="Stage" value={text(item.error_stage)} />
          <DiagnosticLine
            label="Source error type"
            value={
              Array.isArray(item.error_types) ? item.error_types.join(", ") : ""
            }
          />
          <DiagnosticLine
            label="Input spans"
            value={text(item.source_text_with_spans)}
            render={(value) => <HighlightedInput value={value} />}
          />
          <DiagnosticLine
            label="Model output"
            value={text(item.prediction)}
            render={(value) => (
              <HighlightedOutput value={value} spans={normalizedSpans(item)} />
            )}
          />
          <DiagnosticLine
            label="Normalized spans"
            value={
              Array.isArray(item.normalized_spans)
                ? item.normalized_spans.join(" · ")
                : ""
            }
          />
          <DiagnosticLine
            label="Gold/reference spans"
            value={text(item.reference_spans) || text(item.gold_spans)}
          />
          <DiagnosticLine label="Reason" value={text(item.reason)} />
          <DiagnosticLine label="Review note" value={text(item.review_note)} />
        </div>
      </details>
    </article>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Panel({
  title,
  value,
  muted,
}: {
  title: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`panel ${muted ? "muted" : ""}`}>
      <span>{title}</span>
      <p>{value || "No explicit reference provided in this record."}</p>
    </div>
  );
}

function DiagnosticLine({
  label,
  value,
  render,
}: {
  label: string;
  value: string;
  render?: (value: string) => ReactNode;
}) {
  return value ? (
    <div className="diagnostic-line">
      <b>{label}:</b>
      <span>{render ? render(value) : value}</span>
    </div>
  ) : null;
}

const normalizedSpans = (item: Case) =>
  Array.isArray(item.normalized_spans)
    ? item.normalized_spans.filter(
        (span): span is string => typeof span === "string",
      )
    : [];

function HighlightedInput({ value }: { value: string }) {
  const parts = value.split(/(<span>.*?<\/span>)/gis);
  let color = 0;

  return parts.map((part, index) => {
    const match = /^<span>([\s\S]*?)<\/span>$/i.exec(part);

    return match ? (
      <span key={index}>
        {"<span>"}
        <mark className={`span-highlight span-${color++ % 6}`}>
          {match[1]}
        </mark>
        {"</span>"}
      </span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

function HighlightedOutput({
  value,
  spans,
}: {
  value: string;
  spans: string[];
}) {
  const pieces: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    const position = value.indexOf(span, cursor);
    if (position < 0) return;
    if (position > cursor)
      pieces.push(
        <span key={`text-${index}`}>{value.slice(cursor, position)}</span>,
      );
    pieces.push(
      <mark
        className={`span-highlight span-${index % 6}`}
        key={`span-${index}`}
      >
        {span}
      </mark>,
    );
    cursor = position + span.length;
  });
  if (cursor < value.length || pieces.length === 0)
    pieces.push(<span key="tail">{value.slice(cursor)}</span>);
  return pieces;
}

function Filter({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => setValue(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
