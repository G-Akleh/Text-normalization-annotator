# Text Normalization Annotator

A local React app for reviewing text-normalization output from a JSON dataset.

Run `npm install` once, then `npm run dev`. Import a JSON file with a top-level `cases` array and export the annotated result when finished. Decisions are stored in each case's `human_annotation`; **Skip** records `skipped_at` while keeping the case unreviewed.

Keyboard shortcuts outside form fields: `↑`/`↓` navigate cases; `A` correct; `S` semantic error; `D` acceptable alternative; `F` skip.
