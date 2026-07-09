import type {
  Gstr1File, ReconConfig, ReconciliationResult, SummaryData, PeriodSummary,
  ParsedGstrDoc, ParsedEwbDoc, AggGstr, AggEwb, MatchedRow, MatchConfidence,
  GstrOnlyRow, GstrOnlyReason, EwbOnlyRow, EwbOnlyReason,
} from '../types';
import { DEFAULT_CONFIG } from '../types';
import { parseGstrFiles } from './parseGstr';
import { parseEwbFiles } from './parseEwb';
import {
  normalizeDocNo, digitsOnly, round2, uniq, periodLabel, periodFromFp,
} from './utils';

const isNoteCat = (c: string) => c === 'CDNR_C' || c === 'CDNR_D';
const classOf = (c: string) => (isNoteCat(c) ? 'NOTE' : 'INV');

const usableGstin = (g: string) => !!g && g !== 'N/A' && g !== 'EXPORT' && g.length >= 10;

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const aggregateGstr = (docs: ParsedGstrDoc[], cfg: ReconConfig): Map<string, AggGstr> => {
  const map = new Map<string, AggGstr>();
  for (const d of docs) {
    const norm = normalizeDocNo(d.doc_no);
    const cls = classOf(d.category);
    const gUsable = cfg.useGstinInKey && usableGstin(d.buyer_gstin);
    let key = `${gUsable ? d.buyer_gstin : 'NOG'}#${norm}~${cls}`;
    if (!cfg.matchAcrossPeriods) key += `@${d.period}`;

    const ex = map.get(key);
    if (ex) {
      ex.invoice_value += d.invoice_value;
      ex.assessable += d.assessable;
      ex.cgst += d.cgst; ex.sgst += d.sgst; ex.igst += d.igst; ex.cess += d.cess;
      ex.doc_count += 1;
      ex.is_service = ex.is_service || d.is_service;
      if (d.period) ex.periods = uniq([...ex.periods, d.period]);
    } else {
      map.set(key, {
        key, match_keys: [norm], doc_no: d.doc_no, doc_date: d.doc_date,
        buyer_gstin: d.buyer_gstin, place_of_supply: d.place_of_supply, rchrg: d.rchrg,
        category: d.category, is_service: d.is_service,
        periods: d.period ? [d.period] : [],
        invoice_value: d.invoice_value, assessable: d.assessable,
        cgst: d.cgst, sgst: d.sgst, igst: d.igst, cess: d.cess, doc_count: 1,
      });
    }
  }
  return map;
};

const aggregateEwb = (docs: ParsedEwbDoc[], cfg: ReconConfig): Map<string, AggEwb> => {
  const map = new Map<string, AggEwb>();
  for (const d of docs) {
    const norm = normalizeDocNo(d.doc_no);
    const cls = d.doc_type.toLowerCase().includes('credit') || d.doc_type.toLowerCase().includes('debit') ? 'NOTE' : 'INV';
    const gUsable = cfg.useGstinInKey && usableGstin(d.other_party_gstin);
    let key = `${gUsable ? d.other_party_gstin : 'NOG'}#${norm}~${cls}`;
    if (!cfg.matchAcrossPeriods) key += `@${d.period}`;

    const ex = map.get(key);
    if (ex) {
      ex.assessable += d.assessable;
      ex.cgst += d.cgst; ex.sgst += d.sgst; ex.igst += d.igst; ex.cess += d.cess;
      ex.ewb_count += 1;
      ex.rows.push(d);
      if (d.period) ex.periods = uniq([...ex.periods, d.period]);
    } else {
      map.set(key, {
        key, doc_no: d.doc_no, doc_type: d.doc_type,
        other_party_gstin: d.other_party_gstin,
        periods: d.period ? [d.period] : [],
        assessable: d.assessable, cgst: d.cgst, sgst: d.sgst, igst: d.igst, cess: d.cess,
        ewb_no: d.ewb_no, ewb_date: d.ewb_date, doc_dates: d.doc_date,
        ewb_count: 1, rows: [d],
      });
    }
  }
  // finalise joined strings
  map.forEach((e) => {
    e.ewb_no = uniq(e.rows.map((r) => r.ewb_no)).join(', ');
    e.ewb_date = uniq(e.rows.map((r) => r.ewb_date)).join(', ');
    e.doc_dates = uniq(e.rows.map((r) => r.doc_date)).join(', ');
  });
  return map;
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

interface EwbIndexes {
  byKey: Map<string, AggEwb>;
  byNorm: Map<string, AggEwb[]>;   // norm~cls -> entries
  byDigits: Map<string, AggEwb[]>; // digits~cls -> entries
  byValGstin: Map<string, AggEwb[]>; // gstin|roundedAssessable~cls -> entries (doc-no-agnostic)
}

// Doc-number-agnostic key: buyer GSTIN + assessable value (rounded to the rupee) + class.
// Used only as a last resort to catch invoices whose EWB uses a different number series
// (e.g. SGFOC / SG-WR vs the 9000xxxx series) but the same party and value.
const valGstinKey = (gstin: string, assessable: number, cls: string): string =>
  `${gstin}|${Math.round(Math.abs(assessable))}~${cls}`;

const buildEwbIndexes = (ewbMap: Map<string, AggEwb>): EwbIndexes => {
  const byNorm = new Map<string, AggEwb[]>();
  const byDigits = new Map<string, AggEwb[]>();
  const byValGstin = new Map<string, AggEwb[]>();
  ewbMap.forEach((e) => {
    const cls = e.doc_type.toLowerCase().includes('credit') || e.doc_type.toLowerCase().includes('debit') ? 'NOTE' : 'INV';
    const norm = `${normalizeDocNo(e.doc_no)}~${cls}`;
    const dig = `${digitsOnly(e.doc_no)}~${cls}`;
    (byNorm.get(norm) || byNorm.set(norm, []).get(norm)!).push(e);
    if (digitsOnly(e.doc_no)) (byDigits.get(dig) || byDigits.set(dig, []).get(dig)!).push(e);
    if (usableGstin(e.other_party_gstin) && Math.abs(e.assessable) > 1) {
      const vk = valGstinKey(e.other_party_gstin, e.assessable, cls);
      (byValGstin.get(vk) || byValGstin.set(vk, []).get(vk)!).push(e);
    }
  });
  return { byKey: ewbMap, byNorm, byDigits, byValGstin };
};

const buildMatchedRow = (
  g: AggGstr, e: AggEwb, confidence: MatchConfidence, cfg: ReconConfig
): MatchedRow => {
  const note = isNoteCat(g.category);
  const adj = (v: number) => (note ? Math.abs(v) : v);

  const aG = adj(g.assessable), aE = adj(e.assessable);
  const cG = adj(g.cgst), cE = adj(e.cgst);
  const sG = adj(g.sgst), sE = adj(e.sgst);
  const iG = adj(g.igst), iE = adj(e.igst);

  const assessable_var = round2(aE - aG);
  const cgst_var = round2(cE - cG);
  const sgst_var = round2(sE - sG);
  const igst_var = round2(iE - iG);
  const total_tax_var = round2(cgst_var + sgst_var + igst_var);

  const flags: string[] = [];
  if (Math.abs(assessable_var) > cfg.assessableTolerance) flags.push('Assessable mismatch');
  if (Math.abs(cgst_var) > cfg.taxTolerance) flags.push('CGST mismatch');
  if (Math.abs(sgst_var) > cfg.taxTolerance) flags.push('SGST mismatch');
  if (Math.abs(igst_var) > cfg.taxTolerance) flags.push('IGST mismatch');

  // Tax-type (inter vs intra state) mismatch: one side IGST, the other CGST+SGST.
  const gIntra = cG + sG > 1, gInter = iG > 1;
  const eIntra = cE + sE > 1, eInter = iE > 1;
  if ((gInter && eIntra && !eInter) || (gIntra && eInter && !eIntra)) {
    flags.push('Tax type mismatch (inter/intra-state)');
  }

  // GSTIN mismatch (only meaningful when both present)
  if (usableGstin(g.buyer_gstin) && usableGstin(e.other_party_gstin) &&
      g.buyer_gstin !== e.other_party_gstin) {
    flags.push('GSTIN mismatch');
  }

  // Timing difference: periods do not overlap
  const gP = g.periods, eP = e.periods;
  const overlap = gP.some((p) => eP.includes(p));
  if (gP.length && eP.length && !overlap) {
    flags.push(`Timing difference (EWB ${eP.map(periodLabel).join('/')} vs GSTR ${gP.map(periodLabel).join('/')})`);
  }

  if (note) flags.push('Credit/Debit note — verify direction');

  const abs_value_at_risk = round2(Math.max(
    Math.abs(assessable_var),
    Math.abs(cgst_var) + Math.abs(sgst_var) + Math.abs(igst_var)
  ));

  // "clean" = no value/tax/structural flag (a note tag alone still counts as needing a look,
  // but if it ties out we treat it clean except the advisory).
  const blockingFlags = flags.filter((f) => !f.startsWith('Credit/Debit note'));
  const is_clean = blockingFlags.length === 0;

  return {
    key: g.key, doc_no: g.doc_no, ewb_doc_no: e.doc_no,
    doc_date: g.doc_date, ewb_no: e.ewb_no, ewb_date: e.ewb_date,
    buyer_gstin: g.buyer_gstin, place_of_supply: g.place_of_supply,
    category: g.category, match_confidence: confidence,
    gstr_periods: gP.map(periodLabel).join(', '), ewb_periods: eP.map(periodLabel).join(', '),
    invoice_value: round2(g.invoice_value),
    assessable_gstr: round2(g.assessable), cgst_gstr: round2(g.cgst), sgst_gstr: round2(g.sgst), igst_gstr: round2(g.igst),
    assessable_ewb: round2(e.assessable), cgst_ewb: round2(e.cgst), sgst_ewb: round2(e.sgst), igst_ewb: round2(e.igst),
    assessable_var, cgst_var, sgst_var, igst_var, total_tax_var,
    abs_value_at_risk,
    flags, remarks: flags.join('; '), is_clean,
  };
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export const reconcile = (
  gstrJsons: Gstr1File[],
  ewbBuffers: ArrayBuffer[],
  config: Partial<ReconConfig> = {}
): { summary: SummaryData; reportData: ReconciliationResult } => {
  const cfg: ReconConfig = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];

  const { docs: gstrDocs, warnings: gw } = parseGstrFiles(gstrJsons);
  const { docs: ewbDocsAll, warnings: ew } = parseEwbFiles(ewbBuffers);
  warnings.push(...gw, ...ew);

  // Split EWB rows: cancelled / delivery-challan / valid
  const cancelled: ParsedEwbDoc[] = [];
  const deliveryChallans: ParsedEwbDoc[] = [];
  const validEwb: ParsedEwbDoc[] = [];
  for (const d of ewbDocsAll) {
    const st = d.status.toLowerCase();
    const dt = d.doc_type.toLowerCase();
    if (st === 'cancelled' || st === 'canceled') cancelled.push(d);
    else if (dt.includes('delivery challan')) deliveryChallans.push(d);
    else validEwb.push(d);
  }

  const gstrMap = aggregateGstr(gstrDocs, cfg);
  const ewbMap = aggregateEwb(validEwb, cfg);
  const idx = buildEwbIndexes(ewbMap);

  // Global norm sets (period-agnostic) for cross-period timing classification
  const gstrNormSet = new Set<string>();
  gstrMap.forEach((g) => gstrNormSet.add(`${normalizeDocNo(g.doc_no)}~${classOf(g.category)}`));
  const ewbNormSet = new Set<string>();
  ewbMap.forEach((e) => {
    const cls = e.doc_type.toLowerCase().includes('credit') || e.doc_type.toLowerCase().includes('debit') ? 'NOTE' : 'INV';
    ewbNormSet.add(`${normalizeDocNo(e.doc_no)}~${cls}`);
  });

  const consumed = new Set<string>(); // ewb keys already matched
  const completely_matched: MatchedRow[] = [];
  const variances: MatchedRow[] = [];

  const tryFallback = (
    candidates: AggEwb[] | undefined, gstin: string
  ): AggEwb | undefined => {
    if (!candidates) return undefined;
    const free = candidates.filter((c) => !consumed.has(c.key));
    if (free.length === 0) return undefined;
    // prefer same GSTIN, then single candidate
    const byG = free.find((c) => usableGstin(gstin) && c.other_party_gstin === gstin);
    return byG || free[0];
  };

  gstrMap.forEach((g) => {
    const norm = normalizeDocNo(g.doc_no);
    const cls = classOf(g.category);
    let matched: AggEwb | undefined;
    let confidence: MatchConfidence = 'Number Only';

    // 1. direct key (gstin#norm~cls [@period])
    const direct = idx.byKey.get(g.key);
    if (direct && !consumed.has(direct.key)) {
      matched = direct;
      confidence = direct.doc_no === g.doc_no ? 'Exact' : 'GSTIN+Number';
    }
    // 2. norm + class fallback
    if (!matched) {
      matched = tryFallback(idx.byNorm.get(`${norm}~${cls}`), g.buyer_gstin);
      if (matched) confidence = usableGstin(g.buyer_gstin) && matched.other_party_gstin === g.buyer_gstin ? 'GSTIN+Number' : 'Number Only';
    }
    // 3. digits-only fallback
    if (!matched && digitsOnly(g.doc_no)) {
      matched = tryFallback(idx.byDigits.get(`${digitsOnly(g.doc_no)}~${cls}`), g.buyer_gstin);
      if (matched) confidence = 'Number Only';
    }
    // 4. GSTIN + assessable-value fallback (doc-no differs in format). Only fire when the
    //    buyer GSTIN is usable, the value is material, and there is exactly ONE free EWB
    //    candidate with that party+value — to avoid stitching unrelated documents together.
    if (!matched && usableGstin(g.buyer_gstin) && Math.abs(g.assessable) > 1) {
      const vk = valGstinKey(g.buyer_gstin, g.assessable, cls);
      const cands = (idx.byValGstin.get(vk) || []).filter((c) => !consumed.has(c.key));
      if (cands.length === 1) {
        matched = cands[0];
        confidence = 'GSTIN+Value+Date';
      }
    }

    if (matched) {
      consumed.add(matched.key);
      const row = buildMatchedRow(g, matched, confidence, cfg);
      (row.is_clean ? completely_matched : variances).push(row);
    }
  });

  // GSTR-only (unmatched GSTR aggs)
  const matchedGstrKeys = new Set([...completely_matched, ...variances].map((r) => r.key));
  const gstr_only: GstrOnlyRow[] = [];
  gstrMap.forEach((g) => {
    if (matchedGstrKeys.has(g.key)) return;
    const cls = classOf(g.category);
    const normCls = `${normalizeDocNo(g.doc_no)}~${cls}`;
    let reason: GstrOnlyReason;
    if (ewbNormSet.has(normCls)) reason = 'Found in EWB but different period (timing)';
    else if (g.is_service) reason = 'Service supply (no EWB required)';
    else if (isNoteCat(g.category)) reason = 'Credit/Debit note (verify EWB)';
    else if (Math.abs(g.invoice_value) <= cfg.ewbThreshold) reason = 'Below EWB threshold (no EWB required)';
    else reason = 'EWB likely required — not found (review)';
    gstr_only.push({ ...g, reason, total_tax: round2(g.cgst + g.sgst + g.igst) });
  });

  // Periods for which a GSTR-1 was actually uploaded (filing periods + invoice-date periods
  // seen in the JSON). An EWB whose document date falls OUTSIDE this set cannot possibly
  // match — its return simply was not provided — so it must NOT be flagged as an omission.
  const gstrCoveredPeriods = new Set<string>();
  gstrJsons.forEach((f) => { const p = periodFromFp(f?.fp); if (p) gstrCoveredPeriods.add(p); });
  gstrDocs.forEach((d) => { if (d.period) gstrCoveredPeriods.add(d.period); });

  // EWB-only (unconsumed EWB aggs)
  const ewb_only: EwbOnlyRow[] = [];
  ewbMap.forEach((e) => {
    if (consumed.has(e.key)) return;
    const cls = e.doc_type.toLowerCase().includes('credit') || e.doc_type.toLowerCase().includes('debit') ? 'NOTE' : 'INV';
    const normCls = `${normalizeDocNo(e.doc_no)}~${cls}`;
    const tax = round2(e.cgst + e.sgst + e.igst);
    const inUploadedPeriod = e.periods.some((p) => gstrCoveredPeriods.has(p));
    let reason: EwbOnlyReason;
    if (gstrNormSet.has(normCls)) {
      reason = 'Reported in GSTR-1 of a different period (timing)';
    } else if (!inUploadedPeriod) {
      // Its invoice date belongs to a month whose GSTR-1 was not uploaded — timing, not omission.
      reason = 'Invoice date in a period with no GSTR-1 uploaded (likely timing — upload that month’s GSTR-1)';
    } else if (Math.abs(tax) < 1 && Math.abs(e.assessable) > 1) {
      // Value moves but no tax charged (free-of-cost / warranty / sample) — not under-reporting.
      reason = 'Zero-tax / free-of-cost movement (verify — not tax under-reporting)';
    } else {
      reason = 'Not reported in GSTR-1 (possible omission — review)';
    }
    ewb_only.push({ ...e, reason, total_tax: tax });
  });

  // ----- Summary -----
  const gstrPeriods = uniq(gstrDocs.map((d) => d.period)).sort();
  const ewbPeriods = uniq(ewbDocsAll.map((d) => d.period)).sort();
  const periods = uniq([...gstrPeriods, ...ewbPeriods]).sort();
  const gstrFps = uniq(gstrJsons.map((f) => periodFromFp(f?.fp))).sort();

  // Min–max doc-date range per source ("dd/mm/yyyy – dd/mm/yyyy").
  const dateRange = (dates: string[]): string => {
    const sortable = dates
      .filter(Boolean)
      .map((d) => {
        const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        return m ? { key: `${m[3]}${m[2]}${m[1]}`, label: d } : null;
      })
      .filter((x): x is { key: string; label: string } => !!x)
      .sort((a, b) => a.key.localeCompare(b.key));
    if (!sortable.length) return '';
    const lo = sortable[0].label, hi = sortable[sortable.length - 1].label;
    return lo === hi ? lo : `${lo} – ${hi}`;
  };
  const gstrDateRange = dateRange(gstrDocs.map((d) => d.doc_date));
  const ewbDateRange = dateRange(ewbDocsAll.map((d) => d.doc_date));

  const totalTaxAtRisk = round2(variances.reduce(
    (s, r) => s + Math.abs(r.cgst_var) + Math.abs(r.sgst_var) + Math.abs(r.igst_var), 0));
  const ewbOnlyTaxExposure = round2(ewb_only
    .filter((r) => r.reason.startsWith('Not reported'))
    .reduce((s, r) => s + r.total_tax, 0));
  const gstrMissingEwb = gstr_only.filter((r) => r.reason.startsWith('EWB likely required'));
  const gstrOnlyMissingEwbValue = round2(gstrMissingEwb.reduce((s, r) => s + Math.abs(r.assessable), 0));

  // EWB-only rows re-classified out of the under-reporting headline (timing / cross-period, zero-tax).
  const ewbOnlyTimingRows = ewb_only.filter((r) => r.reason.includes('no GSTR-1 uploaded') || r.reason.includes('different period'));
  const ewbOnlyTimingCount = ewbOnlyTimingRows.length;
  const ewbOnlyTimingValue = round2(ewbOnlyTimingRows.reduce((s, r) => s + Math.abs(r.assessable), 0));
  const ewbOnlyZeroTaxCount = ewb_only.filter((r) => r.reason.startsWith('Zero-tax')).length;

  // Incomplete-EWB-upload detector: of the GSTR-1 documents that genuinely need an EWB
  // (taxable goods, above threshold), what share actually found one? A low ratio almost
  // always means the E-Way Bill export was partial, not that EWBs were never generated.
  const matchedCount = completely_matched.length + variances.length;
  const needEwbTotal = matchedCount + gstrMissingEwb.length;
  const ewbCoverageRatio = needEwbTotal > 0 ? round2(matchedCount / needEwbTotal) : 1;
  const ewbFileLikelyIncomplete = gstrMissingEwb.length >= 20 && ewbCoverageRatio < 0.7;
  if (ewbFileLikelyIncomplete) {
    warnings.push(
      `E-Way Bill file appears INCOMPLETE: ${gstrMissingEwb.length} taxable goods invoices ` +
      `(₹${gstrOnlyMissingEwbValue.toLocaleString('en-IN')} assessable) have no matching EWB — ` +
      `only ${Math.round(ewbCoverageRatio * 100)}% of EWB-requiring invoices matched. ` +
      `Re-export the FULL e-way bill list for the exact return period (all sub-users) and re-run ` +
      `before treating this as a compliance gap.`
    );
  }
  const timingDifferenceCount =
    variances.filter((r) => r.flags.some((f) => f.startsWith('Timing'))).length +
    gstr_only.filter((r) => r.reason.includes('timing')).length +
    ewb_only.filter((r) => r.reason.includes('timing')).length;
  const taxTypeMismatchCount = variances.filter((r) => r.flags.some((f) => f.startsWith('Tax type'))).length;
  const gstinMismatchCount = variances.filter((r) => r.flags.some((f) => f.startsWith('GSTIN'))).length;

  // per-period
  const perPeriod: PeriodSummary[] = periods.map((p) => {
    const inP = (arr: string) => arr.split(', ').includes(periodLabel(p));
    const matchedP = completely_matched.filter((r) => inP(r.gstr_periods)).length;
    const varP = variances.filter((r) => inP(r.gstr_periods));
    const gOnlyP = gstr_only.filter((r) => r.periods.includes(p)).length;
    const eOnlyP = ewb_only.filter((r) => r.periods.includes(p)).length;
    return {
      period: p,
      gstrDocs: gstrDocs.filter((d) => d.period === p).length,
      ewbDocs: validEwb.filter((d) => d.period === p).length,
      matched: matchedP,
      variances: varP.length,
      gstrOnly: gOnlyP,
      ewbOnly: eOnlyP,
      taxAtRisk: round2(varP.reduce((s, r) => s + Math.abs(r.cgst_var) + Math.abs(r.sgst_var) + Math.abs(r.igst_var), 0)),
    };
  });

  const summary: SummaryData = {
    periods,
    gstrPeriods,
    ewbPeriods,
    gstrFps,
    gstrDateRange,
    ewbDateRange,
    gstrFiles: gstrJsons.length,
    ewbFiles: ewbBuffers.length,
    validEwbRows: validEwb.length,
    uniqueEwbDocs: ewbMap.size,
    uniqueGstrDocs: gstrMap.size,
    docsInBoth: completely_matched.length + variances.length,
    completelyMatched: completely_matched.length,
    withVariance: variances.length,
    onlyInEwb: ewb_only.length,
    onlyInGstr: gstr_only.length,
    cancelledEwbRows: cancelled.length,
    deliveryChallanRows: deliveryChallans.length,
    totalTaxAtRisk,
    ewbOnlyTaxExposure,
    gstrOnlyMissingEwbValue,
    timingDifferenceCount,
    taxTypeMismatchCount,
    gstinMismatchCount,
    ewbOnlyTimingCount,
    ewbOnlyTimingValue,
    ewbOnlyZeroTaxCount,
    ewbFileLikelyIncomplete,
    ewbCoverageRatio,
    gstrMissingEwbCount: gstrMissingEwb.length,
    perPeriod,
  };

  // sort exception lists by money, descending — most actionable first
  variances.sort((a, b) => b.abs_value_at_risk - a.abs_value_at_risk);
  ewb_only.sort((a, b) => b.total_tax - a.total_tax || Math.abs(b.assessable) - Math.abs(a.assessable));
  gstr_only.sort((a, b) => Math.abs(b.assessable) - Math.abs(a.assessable));

  const reportData: ReconciliationResult = {
    completely_matched, variances, ewb_only, gstr_only,
    cancelled_ewb: cancelled, delivery_challans: deliveryChallans,
    config: cfg, warnings,
  };

  return { summary, reportData };
};
