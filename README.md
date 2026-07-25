# Shiftwise

A manager-facing worker scheduling app with an exact mixed-integer optimizer.

Open `index.html` in a modern browser to use it. Safari's local-file WebAssembly restriction is handled by the generated `highs-wasm.js` bundle. Schedule and preference data is saved in that browser's local storage. The vendored HiGHS WebAssembly solver performs exact full-month optimization locally; no schedule data is uploaded.

All executable application code is written in TypeScript. The source files are `src/app.ts`, `src/scheduler-engine.ts`, and `src/types.ts`. `index.html` loads the generated files in `dist/`, so it can still be opened directly without a development server.

Features include:

- 8h day/night and 12h day/night coverage, with no 8h night shifts at weekends by default
- Worker target hours, day/night preferences, and normal or reverse 24h pair preferences
- Whole-day, day/morning, and night unavailability
- Automatic scheduling that balances target-hour progress and enforces the 24h recovery rule
- Exact timestamp overlap/rest checks, including overnight duties and daylight-saving changes
- Configurable continuous 24h pairings built from any two shift templates
- Draft, published, and archived schedules with versions, undo/redo, and locked assignments
- Drag-and-drop editing, filters, weekly/per-worker views, and bulk assignment
- Assignment and infeasibility explanations
- Operational reports, payroll-ready XLSX, CSV, PDF, and ICS exports
- Import of worker targets, preferences and unavailability from a Google Sheet the team fills in

## Collecting data from the team in Google Sheets

Workers → **Sheet template** downloads a workbook that already contains the current roster and month.
Upload it to Google Drive, share it with the team, and let everyone fill in their own row. The workbook has
three tabs, all in Polish:

- `Instrukcja` — what to fill in, and the legend
- `Pracownicy` — filled in by the team, one row per person: `Imię i nazwisko`, `Godziny docelowe`,
  `Preferowana pora` (Dzień / Noc / Bez preferencji), `Dyżur 24h` (Nie / Dowolny / a pairing name)
- `Dostępność` — a grid with one row per person and one column per day of the month. A cell holds
  `X` (unavailable all day), `D` (unavailable in the morning/day), `N` (unavailable at night), or nothing
  at all when the person is available. Cell `B1` holds the month as `YYYY-MM`
- `Administrator` — the scheduler's own tab: `Imię i nazwisko`, `Kategorie`,
  `Uprawnienia kierownika`, `Kierownik domyślny`, `Uwagi`. Who is qualified for what is not something
  the team should be able to grant itself, so this tab is protected

The two worker tabs are merged per person by name, so each person is imported once with the fields
taken from both. Somebody left off the `Administrator` tab simply keeps whatever the app already holds.

Protection differs by route, and only one of them is a real lock:

- **Apps Script** — `Administrator` is protected with every other editor removed, so only the
  spreadsheet's owner can edit it. The team sees it and is refused on edit. The header rows of the two
  employee tabs are protected the same way, since renaming a header is what breaks the importer.
- **`.xlsx`** — the sheet carries Excel's protection flag. That is a guardrail against fat fingers, not
  a lock: in Excel it comes off in one click, and how Drive treats it on import is up to Drive.

When the team is done: File → Download → Microsoft Excel (.xlsx), then Workers → **Import from sheet**
(or drop the file on the card). Nothing is written until you confirm the preview, which lists every change,
every new person, and every row that could not be read. **Undo last import** restores the roster,
categories and unavailability exactly as they were.

Column order does not matter and extra columns are ignored — the importer matches by header name, in
Polish or English, and matches people by name ignoring case, diacritics and word order. A single-tab
`.csv` export works too.

`templates/` holds a blank workbook and a filled-in example with dropdowns, colour coding, weekend
shading and a running `Razem` count per person. Regenerate them for another month with:

```sh
python3 scripts/make-sheet-template.py --month 2026-09          # blank
python3 scripts/make-sheet-template.py --month 2026-09 --sample # filled-in example
```

### Building the sheet natively instead of importing a file

There is no such thing as an offline Google Sheets file — a Google Sheet is a cloud document, and
`.gsheet` files are only pointers to one. Uploading the `.xlsx` above and letting Drive convert it is
the usual route, but `scripts/grafik-arkusz.gs` builds the same layout *inside* Google Sheets instead,
using Google's own validation and conditional formatting, with no conversion step:

1. In a new Google Sheet: Extensions → Apps Script
2. Paste the contents of `scripts/grafik-arkusz.gs`, save, and reload the spreadsheet
3. A **Grafik** menu appears: *Utwórz arkusz na miesiąc…* builds both tabs for a month you type in

The same menu has *Wyczyść dostępność i ustaw nowy miesiąc…*, which rebuilds the `Dostępność` grid for
the next month and carries the roster over, so one spreadsheet serves the whole year.

The layout lives in two places that must stay in step: `scripts/make-sheet-template.py` writes it and
`src/sheet-io.ts` reads it. `tests/sheet-io.test.js` parses the generated example to keep them honest.

Build, type-check, and run the automated verification suite:

```sh
pnpm run build
pnpm run typecheck
pnpm test
```
