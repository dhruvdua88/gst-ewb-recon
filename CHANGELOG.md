# Changelog

All notable changes to the E-Way Bill vs GSTR-1 reconciliation tool.

## [1.4.0] — 2026-07-09

### Fixed
- **Doc-number collision (accuracy bug, multi-period).** Distinct EWB documents that
  only *normalised* alike — e.g. `90003639` and `90003639-` (trailing dash), two
  different consignments the portal emits — were being merged into one aggregation
  bucket and their assessable/tax values **summed**, inflating EWB values and
  manufacturing false variances. Because the colliding rows sat in different months'
  files, this surfaced only when several periods were loaded together. Aggregation now
  keys on the **raw** document number (see `rawDocKey`), so different documents never
  merge. On the 4-period Karnataka dataset this cut false variances from 46 → 22.
- **Value-aware matching.** When several EWB documents share the same normalised
  number for one GSTIN, the invoice now matches the one whose **assessable value
  ties** to it, instead of whichever raw string sorted first — so the correct EWB is
  paired (e.g. the dash variant that equals the invoice value matches cleanly).

### Changed
- **Multi-file import now accumulates.** Selecting files no longer replaces the
  previous selection — GSTR-1 JSONs and EWB files add up across picks/folders (deduped
  by name+size), with a per-box file list, guessed periods, and a Clear button. This is
  what lets you load all four periods' JSON + EWB together.

## [1.3.0] — 2026-07-09

### Added
- **Action Register** — a curated "do this" list (tab + Excel sheet + emailable
  section) containing only items needing human action (genuine value mismatches,
  truly-missing EWBs, missing GSTR-1 uploads), highest value first. Timing, FOC and
  correct exclusions are omitted by design. When the EWB file looks incomplete, the
  hundreds of likely-false "missing EWB" rows collapse into one "re-export" action.
- **Filename period hints** — each uploaded file shows the return period guessed from
  its name (pre-run UX aid only).

### Changed
- **Part-dispatch detection** — a matched document whose EWB value is *below* the
  invoice is flagged "possible part-dispatch, verify remaining consignment" (vs a
  blanket "assessable mismatch"); EWB above invoice is flagged "verify".
- **Export / SEZ awareness** — export and SEZ invoices get their own reason
  ("verify EWB via shipping/port docs") and no longer inflate the "EWB likely
  required — not found" figure.

## [1.2.0] — 2026-07-09

### Added
- **Period-coverage matrix** — per-period chips showing whether a GSTR-1 and/or an
  e-way bill was uploaded for each period, so coverage gaps are visible before the
  numbers are trusted.
- **"Add the missing GSTR-1" nudge** — when an e-way bill falls in a month whose
  GSTR-1 was not uploaded, the tool names that return and the count/value of timing
  rows adding it would resolve (UI + emailable report).

### Changed
- **Period-coverage timing fix** — an EWB whose invoice date falls in a month with
  no GSTR-1 uploaded is now classified as a timing item (not "possible omission")
  and excluded from the EWB-only under-reporting figure.
- **Incomplete-EWB-upload detector** — when many taxable goods invoices have no
  matching EWB (≥20 rows and <70% coverage), a banner tells the user to re-export
  the full period before treating it as a compliance gap.
- **Zero-tax / free-of-cost tag** — EWB-only rows with value but no tax are tagged
  as zero-tax movements rather than under-reporting.
- **GSTIN + value + date fallback match** — last-resort match when doc-numbers
  differ in format, fired only when exactly one free candidate exists.
