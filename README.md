# E-Way Bill vs GSTR-1 Reconciliation Tool

A browser-based tool to reconcile **GSTR-1** (offline-utility JSON) against **E-Way Bill** reports (Excel),
across **one or many filing periods at once**. Everything runs locally in the browser — no data leaves your machine.

It is a substantial rework of an earlier single-period prototype, with a rebuilt matching engine,
multi-period support, more reconciliation logic, edge-case handling, and an actionable, money-led report.

## What it does

Upload all your GSTR-1 JSONs and all your E-Way Bill Excel files for a span (e.g. a full quarter or year),
set tolerances, and reconcile. The tool categorises every document and produces an on-screen dashboard,
a full multi-sheet Excel workbook, and an emailable HTML summary.

### Reconciliation logic

- **Multi-period engine.** Each GSTR-1 is tagged by its filing period (`fp`); each E-Way Bill row by its
  document-date period. The whole span is reconciled together.
- **Timing-difference detection.** When a document matches but the EWB month ≠ the GSTR-1 month, it is flagged
  as a *timing difference* rather than reported as missing on both sides — the classic real-world recon noise.
- **GSTIN-aware, multi-pass matching** with confidence levels:
  1. **Exact** — same buyer GSTIN + identical document number.
  2. **GSTIN+Number** — same GSTIN + normalised number.
  3. **Number Only** — normalised / digits-only number fallback (lower confidence, flagged).
- **Smarter number normalisation.** `INV/0007` and `INV7` match, but `INV7` and `PO7` stay distinct — fixing the
  old behaviour that collapsed every number to a bare integer and merged unrelated documents.
- **Tax-type (inter/intra-state) mismatch** detection — IGST on one side vs CGST+SGST on the other (wrong place of supply).
- **GSTIN mismatch** flag when both sides carry a GSTIN but they differ.
- **Configurable tolerances** for assessable value and per-head tax (default ₹1).

### GSTR-1 coverage

Reads **B2B, B2BA (amendments), SEZ, Exports (EXP), and CDNR (credit/debit notes)**.
Credit notes carry a negative sign; note magnitudes are compared against EWB credit-note movements.

### Edge cases handled

- **₹50,000 EWB threshold** — GSTR-1 documents at/below the threshold are classified *"no EWB required"*, not flagged as exceptions.
- **Services (SAC 99…)** — flagged *"no EWB required"*.
- **Cancelled E-Way Bills** — excluded from matching, kept in their own sheet, and cross-referenced.
- **Delivery challans** — excluded from invoice matching, kept separately.
- **Multiple EWBs per invoice** (partial / multi-vehicle) — summed, with a count.
- **Multiple GSTR-1 lines per invoice** — summed.
- **Duplicate document numbers across buyers** — disambiguated by GSTIN in the key.
- **Blank / missing document numbers, banner rows, varied date formats** (Excel serial, dd-mm-yyyy, yyyy-mm-dd).
- **Period-locked mode** (optional) — match only within the same month; cross-period appearances are then labelled as timing.

### Actionable report

- **Money at a glance:** total tax at risk (variances), EWB-only tax exposure (possible under-reporting),
  and GSTR value that likely needed an EWB.
- **Exception lists are pre-sorted by money** — work top-down.
- **Period-wise pivot** of matched / variances / only-in-X / tax-at-risk.
- **Excel workbook:** Summary, Period_Summary, Variances, Completely_Matched, EWB_Only, GSTR_Only,
  Cancelled_EWB, Delivery_Challans, Warnings.
- **Emailable HTML** with the headline numbers, period table, top exceptions, and recommended next steps.

## Inputs

- **GSTR-1:** the JSON produced by the GST offline utility / portal export. One file per period.
- **E-Way Bill:** the Excel report from the EWB portal. Headers are matched fuzzily, so minor column-name
  variations are tolerated. Required: a *Document No* column; recommended: Document Date, Status, Document Type,
  Other Party GSTIN, Assessable Value, CGST/SGST/IGST.

## Run locally

Prerequisites: Node.js 18+.

```bash
npm install
npm run dev       # http://localhost:3000
npm run typecheck # optional
npm run build     # production build in dist/
```

## Privacy

All parsing and reconciliation happens in the browser via SheetJS. No file is uploaded anywhere.

## License

MIT
