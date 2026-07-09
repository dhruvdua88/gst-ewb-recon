// ---------------------------------------------------------------------------
// GSTR-1 offline-utility JSON shapes (subset we read)
// ---------------------------------------------------------------------------

export interface Gstr1ItemDetail {
  txval: number; // taxable / assessable value
  camt: number;  // CGST
  samt: number;  // SGST
  iamt: number;  // IGST
  csamt?: number; // Cess
  rt?: number;   // rate
  hsn_sc?: string;
}

export interface Gstr1Item {
  itm_det: Gstr1ItemDetail;
  num: number;
}

export interface Gstr1Invoice {
  inum: string;
  idt: string; // dd-mm-yyyy per GSTR-1 spec
  val: number | string; // invoice value (incl tax)
  pos?: string; // place of supply (state code)
  rchrg?: 'Y' | 'N';
  inv_typ?: string;
  itms: Gstr1Item[];
  ctin?: string; // buyer GSTIN (B2B) / recipient
  // CDNR (credit/debit note) specific
  ntty?: 'C' | 'D'; // note type: Credit / Debit
  nt_num?: string;  // note number (CDNR uses nt_num instead of inum)
  nt_dt?: string;   // note date
}

export interface Gstr1Section {
  ctin?: string;
  inv?: Gstr1Invoice[];
  // CDNR uses `nt` array
  nt?: Gstr1Invoice[];
}

export interface Gstr1File {
  gstin: string;
  fp?: string; // filing period MMYYYY, e.g. 032026
  b2b?: Gstr1Section[];
  b2ba?: Gstr1Section[]; // amended B2B
  sez?: Gstr1Section[];
  exp?: { exp_typ?: string; inv?: Gstr1Invoice[] }[];
  cdnr?: Gstr1Section[]; // credit/debit notes to registered
}

// ---------------------------------------------------------------------------
// Domain model after parsing / aggregation
// ---------------------------------------------------------------------------

export type DocCategory = 'INV' | 'CDNR_C' | 'CDNR_D' | 'EXP' | 'SEZ' | 'B2BA';

export interface ParsedGstrDoc {
  source_section: string;       // b2b / exp / cdnr / sez / b2ba
  category: DocCategory;
  doc_no: string;               // raw invoice / note number
  doc_date: string;             // dd/mm/yyyy normalised
  period: string;               // YYYY-MM (from fp if present else doc_date)
  fp: string;                   // raw MMYYYY (or derived)
  buyer_gstin: string;          // ctin or 'EXPORT'
  place_of_supply: string;
  rchrg: 'Y' | 'N';
  invoice_value: number;
  assessable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  is_service: boolean;          // any HSN/SAC starts with 99
  sign: 1 | -1;                 // credit notes carry -1
}

export interface ParsedEwbDoc {
  doc_no: string;               // raw document number
  doc_date: string;             // dd/mm/yyyy
  period: string;               // YYYY-MM from doc_date
  doc_type: string;             // Tax Invoice / Bill of Supply / Credit Note / Delivery Challan / ...
  status: string;               // Active / Cancelled
  other_party_gstin: string;
  supply_type: string;          // Outward / Inward
  assessable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  ewb_no: string;
  ewb_date: string;
  raw: Record<string, any>;     // original row, for drill-down sheets
}

// Aggregated by reconciliation key (one logical document)
export interface AggGstr {
  key: string;
  match_keys: string[];
  doc_no: string;
  doc_date: string;
  buyer_gstin: string;
  place_of_supply: string;
  rchrg: 'Y' | 'N';
  category: DocCategory;
  is_service: boolean;
  periods: string[];            // distinct GSTR periods this doc appears in
  invoice_value: number;
  assessable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  doc_count: number;            // how many GSTR lines folded in
}

export interface AggEwb {
  key: string;
  doc_no: string;
  doc_type: string;
  other_party_gstin: string;
  periods: string[];            // distinct EWB periods
  assessable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  ewb_no: string;               // joined
  ewb_date: string;             // joined
  doc_dates: string;            // joined doc dates
  ewb_count: number;            // number of EWBs folded in
  rows: ParsedEwbDoc[];
}

export type MatchConfidence = 'Exact' | 'GSTIN+Number' | 'Number Only' | 'GSTIN+Value+Date';

export interface MatchedRow {
  key: string;
  doc_no: string;
  ewb_doc_no: string;
  doc_date: string;
  ewb_no: string;
  ewb_date: string;
  buyer_gstin: string;
  place_of_supply: string;
  category: DocCategory;
  match_confidence: MatchConfidence;
  gstr_periods: string;
  ewb_periods: string;
  // GSTR values
  invoice_value: number;
  assessable_gstr: number;
  cgst_gstr: number;
  sgst_gstr: number;
  igst_gstr: number;
  // EWB values
  assessable_ewb: number;
  cgst_ewb: number;
  sgst_ewb: number;
  igst_ewb: number;
  // variances (ewb - gstr)
  assessable_var: number;
  cgst_var: number;
  sgst_var: number;
  igst_var: number;
  total_tax_var: number;
  abs_value_at_risk: number;    // max abs of assessable/tax variances, for prioritisation
  flags: string[];              // structured remark tags
  remarks: string;              // joined
  is_clean: boolean;
}

export type GstrOnlyReason =
  | 'EWB likely required — not found (review)'
  | 'Below EWB threshold (no EWB required)'
  | 'Service supply (no EWB required)'
  | 'Credit/Debit note (verify EWB)'
  | 'Found in EWB but different period (timing)';

export interface GstrOnlyRow extends AggGstr {
  reason: GstrOnlyReason;
  total_tax: number;
}

export type EwbOnlyReason =
  | 'Not reported in GSTR-1 (possible omission — review)'
  | 'Reported in GSTR-1 of a different period (timing)'
  | 'Invoice date in a period with no GSTR-1 uploaded (likely timing — upload that month’s GSTR-1)'
  | 'Zero-tax / free-of-cost movement (verify — not tax under-reporting)'
  | 'Invoice cancelled in GSTR-1? (verify)'
  | 'Delivery challan / non-invoice movement';

export interface EwbOnlyRow extends AggEwb {
  reason: EwbOnlyReason;
  total_tax: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ReconConfig {
  assessableTolerance: number;  // rupees
  taxTolerance: number;         // rupees per tax head
  ewbThreshold: number;         // consignment value threshold for EWB (default 50000)
  matchAcrossPeriods: boolean;  // true => union match (detect timing); false => period-locked
  useGstinInKey: boolean;       // include buyer GSTIN in match key
}

export const DEFAULT_CONFIG: ReconConfig = {
  assessableTolerance: 1,
  taxTolerance: 1,
  ewbThreshold: 50000,
  matchAcrossPeriods: true,
  useGstinInKey: true,
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface PeriodSummary {
  period: string;
  gstrDocs: number;
  ewbDocs: number;
  matched: number;
  variances: number;
  gstrOnly: number;
  ewbOnly: number;
  taxAtRisk: number;
}

export interface SummaryData {
  periods: string[];
  // Per-source coverage (what each uploaded file actually spans).
  gstrPeriods: string[];     // tax periods seen in the GSTR-1 JSON(s)
  ewbPeriods: string[];      // doc-date periods seen in the E-Way Bill file(s)
  gstrFps: string[];         // GSTR-1 filing periods (fp) as YYYY-MM
  gstrDateRange: string;     // "10/04/2026 – 28/04/2026" or ''
  ewbDateRange: string;
  gstrFiles: number;
  ewbFiles: number;
  validEwbRows: number;
  uniqueEwbDocs: number;
  uniqueGstrDocs: number;
  docsInBoth: number;
  completelyMatched: number;
  withVariance: number;
  onlyInEwb: number;
  onlyInGstr: number;
  cancelledEwbRows: number;
  deliveryChallanRows: number;
  // actionable money figures
  totalTaxAtRisk: number;           // sum of abs tax variance on matched-with-variance
  ewbOnlyTaxExposure: number;       // tax on EWBs genuinely not in GSTR (possible under-reporting)
  gstrOnlyMissingEwbValue: number;  // assessable of GSTR docs that likely needed an EWB
  timingDifferenceCount: number;
  taxTypeMismatchCount: number;
  gstinMismatchCount: number;
  // EWB-only rows re-classified out of "under-reporting" (timing / cross-period / zero-tax)
  ewbOnlyTimingCount: number;       // count of EWB-only rows whose period has no GSTR-1 uploaded
  ewbOnlyTimingValue: number;       // assessable of those rows (headline that is NOT real omission)
  ewbOnlyZeroTaxCount: number;      // count of zero-tax / FOC EWB-only rows
  // Incomplete-EWB-upload detector
  ewbFileLikelyIncomplete: boolean; // true when many taxable goods invoices have no EWB
  ewbCoverageRatio: number;         // matched / (matched + GSTR "EWB likely required") , 0..1
  gstrMissingEwbCount: number;      // count of GSTR docs flagged "EWB likely required — not found"
  perPeriod: PeriodSummary[];
}

export interface ReconciliationResult {
  completely_matched: MatchedRow[];
  variances: MatchedRow[];
  ewb_only: EwbOnlyRow[];
  gstr_only: GstrOnlyRow[];
  cancelled_ewb: ParsedEwbDoc[];
  delivery_challans: ParsedEwbDoc[];
  config: ReconConfig;
  warnings: string[];
}
