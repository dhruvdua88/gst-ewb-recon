# Improvement Spec — E-Way Bill vs GSTR-1 Reconciliation

Synthesised from a four-track analysis (UI/UX, reconciliation engine, reporting/exports,
architecture) run on 2026-07-10 against v1.7.0. Each item has acceptance criteria; phases
are ordered so every release is shippable on its own.

Baseline reality: browser-only React+Vite app on GitHub Pages; users are accountants
loading multi-month GSTR-1 JSONs + E-Way Bill Excel/HTML exports; outputs are a styled
Excel workbook + an emailable HTML report. Engine already handles multi-period matching,
doc-no collisions, timing, challan cross-match, recipient-generated-EWB detection.

---

## Phase 1 — Trust & Safety net (v1.8)

The app has zero tests and two runtime CDNs left. Before adding features, make change safe.

### 1.1 Golden tests for the engine  [effort L, impact HIGH]
- Add `vitest`; create `services/reconcile.test.ts` + `fixtures/` (small anonymised
  GSTR JSON + EWB HTML-xls pairs distilled from the 4-period dataset).
- Golden cases: (a) multi-period aggregation with the `90003639` / `90003639-` collision,
  (b) timing classification (invoice in month with no GSTR-1 uploaded),
  (c) challan cross-match, (d) below-threshold, (e) value-aware matching picks the
  value-tied candidate, (f) recipient/ex-works classification.
- Accept: `npm test` green; the 4-period dataset totals (matched 896 / var 22 / gstrOnly 671
  with its reason split) locked in as a regression snapshot.

### 1.2 Bundle the last runtime CDNs  [effort M, impact HIGH]
- `import * as XLSX from 'xlsx-js-style'` in excelService/parseEwb (remove
  `declare const XLSX` + the jsdelivr `<script>`); remove the dead esm.sh importmap
  (react already bundles). App must work fully offline after first load.
- Accept: `dist/index.html` has no external `<script>`; reconcile + Excel export run
  with network blocked.

### 1.3 CI gate  [effort M, impact HIGH]
- `.github/workflows/ci.yml`: on push/PR → `npm ci`, typecheck, test, build, and the
  deploy.sh html↔asset consistency check. Deploy job on tag `v*` publishes gh-pages
  (replaces manual deploy.sh runs; script stays for local use).
- Accept: a PR with a failing test cannot merge; tagging vX.Y.Z auto-deploys.

### 1.4 Error boundary + versioned footer  [effort S, impact MED]
- React ErrorBoundary around the app (fallback: message + reload button, never a white
  screen). Footer shows `v{package.json version}` so screenshots identify the build.

---

## Phase 2 — Results you can work with (v1.9)

The tables are read-only dumps; accountants triage hundreds of rows.

### 2.1 Table sort / filter / search  [effort M, impact HIGH]
- Every DataTable column header click-sorts (numeric aware); sticky filter bar:
  free-text search (doc no / GSTIN), reason dropdown, period dropdown.
- Accept: on the 671-row GSTR-only tab, filtering reason="EWB likely required" and
  sorting by assessable desc takes two clicks.

### 2.2 Pagination / virtualisation  [effort M, impact MED]
- 50 rows per page with "Rows X–Y of Z" and prev/next (or windowed rendering).
  DOM stays under ~200 rows regardless of dataset.

### 2.3 Progress + validation feedback  [effort M, impact HIGH]
- Replace the single spinner with staged progress ("Parsing GSTR-1 2/4 → Parsing EWB →
  Matching → Building results") — the engine already runs in distinct phases.
- Validate files on add, not on Reconcile: JSON parse + `fp` presence badge (✓/✗),
  EWB first-row header sniff. Bad file shows ✗ with the reason inline in the file list.
- Accept: dropping a corrupt JSON shows the error immediately next to that file.

### 2.4 Row drill-down  [effort M, impact MED]
- Click a matched/variance row → expandable detail: GSTR values left, EWB values right,
  variances highlighted; all EWB numbers/dates for consolidated rows.

### 2.5 Elevated warnings + explainer lines  [effort S, impact HIGH]
- Warnings (incomplete EWB export, missing GSTR-1 period) move above the KPI cards —
  red/amber blocks. Each tab gets a one-line "what this list means / what to do" caption
  (already partially present; make consistent).

---

## Phase 3 — Engine depth (v2.0)

Highest-value correctness gaps from the engine analysis.

### 3.1 Consolidated EWB (1 EWB : N invoices)  [effort L, impact HIGH]
- Post-match pass: group unmatched GSTR invoices by buyer; if a subset's summed
  assessable ≈ an unmatched EWB (±2%), link them; reason "Consolidated EWB covers
  N invoices" with the EWB no. Subset-sum bounded (≤5 invoices/group) to stay fast.

### 3.2 Split shipments (N EWBs : 1 invoice)  [effort M, impact HIGH]
- Already sums same-raw-doc-no EWBs; extend to same *normalised* doc-no across periods
  when the summed value ties the invoice (this closes the ₹68,400 Apr case class).
  Flag "part-dispatch complete" vs "short-shipped (Δ remaining)".

### 3.3 EWB credit-note sign  [effort S, impact HIGH]
- Apply −1 to credit-note EWB values at parse so they match CDNR_C rows instead of
  producing sign variances.

### 3.4 GSTIN normalisation at GSTR parse  [effort S, impact MED]
- `normalizeGstin(sec.ctin)` in parseGstr (EWB side already normalises); kills
  case-mismatch misses.

### 3.5 Config depth  [effort M, impact MED]
- Percent-based assessable tolerance `max(₹tol, x%)`; per-head tax tolerances;
  configurable excluded EWB statuses (add Rejected/Expired); optional
  min-match-confidence with demotion to review list.

### 3.6 Performance  [effort M, impact MED]
- Move parse+reconcile into a Web Worker (UI stays responsive; enables 2.3 progress
  events). Cache per-normCls candidate sorts (kills the O(n²·log n) worst case).

---

## Phase 4 — Reporting polish (v2.1)

### 4.1 Excel triage aids  [effort M, impact HIGH]
- Freeze header row + autofilter on every data sheet; conditional colour on
  value-at-risk (red >₹1L, amber >₹10k); Variances columns reordered
  (doc, buyer, remarks, Δs first, detail after); cess_var added.

### 4.2 Buyer concentration  [effort S, impact HIGH]
- Summary + HTML report: "Top 5 buyers by variance/missing value" table — one buyer is
  usually most of the problem (e.g. 08AAICR1703J1ZE cluster in the Apr data).

### 4.3 Action Register workflow columns  [effort S, impact MED]
- Add blank Owner / Status / Due date columns to the Excel sheet; rename Amount →
  "₹ at stake"; per-row suffix clarifying tax-Δ vs assessable.

### 4.4 Outlook-safe HTML  [effort S, impact MED]
- Drop border-radius/opacity reliance in the emailable report (Outlook strips them);
  solid fallback colours; "Showing 15 of N — see Excel Action_Register" banner when
  truncated; report-info block (files used, config, run timestamp) in both HTML and a
  new Excel "Report_Info" sheet for auditability.

### 4.5 Indian number formatting everywhere  [effort S, impact LOW]
- Lakh/crore digit grouping consistently in Excel `z` formats and HTML (`en-IN` already
  used in UI; extend to exports).

---

## Explicitly deferred
- Mobile-first tables (accountants use desktops; keep the existing responsive scroll).
- Server-side anything — browser-only is a feature (data never leaves the machine).
- Levenshtein fuzzy doc-no matching — false-positive risk outweighs the tail it catches;
  revisit after 3.1/3.2 land and residual unmatched counts are known.

## Sequencing rationale
Phase 1 first because Phases 2–4 change engine/UI behaviour and need the safety net;
Phase 2 before 3 because triage UX pays off on every dataset while engine depth pays off
on hard datasets; Phase 4 last because exports inherit whatever the engine/labels say.
