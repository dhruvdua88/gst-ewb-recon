import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from './utils';

declare const XLSX: any; // xlsx-js-style from CDN — honours cell.s styles

const fmtMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Style palette
// ---------------------------------------------------------------------------
const C = {
  ink: '1E293B',        // slate-800
  indigo: '4338CA',     // header fill
  slate: '334155',      // section banner
  slateLt: 'F1F5F9',    // zebra
  green: '16A34A',
  greenLt: 'DCFCE7',
  amber: 'B45309',
  amberLt: 'FEF3C7',
  red: 'DC2626',
  redLt: 'FEE2E2',
  white: 'FFFFFF',
  grid: 'CBD5E1',
};

const INR = '"₹"#,##,##0.00;[Red]-"₹"#,##,##0.00'; // Indian lakh grouping
const thinBorder = () => {
  const s = { style: 'thin', color: { rgb: C.grid } };
  return { top: s, bottom: s, left: s, right: s };
};

const S = {
  title: { font: { bold: true, sz: 16, color: { rgb: C.white } }, fill: { fgColor: { rgb: C.indigo } }, alignment: { horizontal: 'left', vertical: 'center' } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: C.white } }, fill: { fgColor: { rgb: C.indigo } }, alignment: { horizontal: 'left', vertical: 'center' } },
  section: { font: { bold: true, sz: 11, color: { rgb: C.white } }, fill: { fgColor: { rgb: C.slate } }, alignment: { horizontal: 'left', vertical: 'center' } },
  label: { font: { color: { rgb: C.ink } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder() },
  labelBold: { font: { bold: true, color: { rgb: C.ink } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder() },
  val: { alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder() },
  valBold: { font: { bold: true }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder() },
  tableHead: { font: { bold: true, color: { rgb: C.white }, sz: 10 }, fill: { fgColor: { rgb: C.indigo } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinBorder() },
};

const chip = (fg: string, bg: string) => ({
  font: { bold: true, color: { rgb: fg } },
  fill: { fgColor: { rgb: bg } },
  alignment: { horizontal: 'right', vertical: 'center' },
  border: thinBorder(),
});

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------
const setCell = (ws: any, r: number, c: number, v: any, s?: any, z?: string) => {
  const addr = XLSX.utils.encode_cell({ r, c });
  const isNum = typeof v === 'number' && isFinite(v);
  ws[addr] = { t: isNum ? 'n' : 's', v: isNum ? fmtMoney(v) : (v ?? '') };
  if (s) ws[addr].s = s;
  if (z) ws[addr].z = z;
};

const MONEY_RE = /value|assessable|cgst|sgst|igst|cess|tax|var|risk|exposure/i;
const COUNT_RE = /count|docs|rows|^matched$|^variances$|only/i;
const isMoneyCol = (h: string) => MONEY_RE.test(h) && !COUNT_RE.test(h);

// Build a styled data sheet from row objects.
const styledSheet = (rows: any[], headers: string[]): any => {
  const ws: any = {};
  headers.forEach((h, c) => setCell(ws, 0, c, h.replace(/_/g, ' ').toUpperCase(), S.tableHead));
  rows.forEach((row, i) => {
    const r = i + 1;
    const zebra = i % 2 === 1 ? { fill: { fgColor: { rgb: C.slateLt } } } : {};
    headers.forEach((h, c) => {
      const raw = row[h];
      const money = isMoneyCol(h);
      const cellStyle = { ...(money ? S.val : S.label), ...zebra, border: thinBorder() };
      setCell(ws, r, c, typeof raw === 'number' ? raw : (raw ?? ''), cellStyle, money ? INR : undefined);
    });
  });
  const lastR = rows.length;
  const lastC = headers.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastR, 0), c: Math.max(lastC, 0) } });
  ws['!cols'] = headers.map((h) => {
    let w = h.length + 3;
    rows.forEach((row) => { const v = row[h]; const len = v == null ? 0 : String(v).length + 1; if (len > w) w = len; });
    return { wch: Math.min(Math.max(w, 9), 48) };
  });
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  if (rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } }) };
  return ws;
};

// ---------------------------------------------------------------------------
// Summary (dashboard) sheet
// ---------------------------------------------------------------------------
const buildSummarySheet = (summary: SummaryData, cfg: ReconciliationResult['config']): any => {
  const ws: any = {};
  const COLS = 4; // A..D
  let r = 0;
  const merges: any[] = [];

  const wide = (text: string, style: any) => {
    setCell(ws, r, 0, text, style);
    for (let c = 1; c < COLS; c++) setCell(ws, r, c, '', style);
    merges.push({ s: { r, c: 0 }, e: { r, c: COLS - 1 } });
    r++;
  };
  const blank = () => { setCell(ws, r, 0, '', {}); r++; };
  const kv = (label: string, value: any, opts: { valStyle?: any; z?: string; bold?: boolean } = {}) => {
    setCell(ws, r, 0, label, opts.bold ? S.labelBold : S.label);
    setCell(ws, r, 1, '', opts.bold ? S.labelBold : S.label);
    setCell(ws, r, 2, value, opts.valStyle || (opts.bold ? S.valBold : S.val), opts.z);
    setCell(ws, r, 3, '', opts.valStyle || S.val);
    merges.push({ s: { r, c: 0 }, e: { r, c: 1 } });
    merges.push({ s: { r, c: 2 }, e: { r, c: 3 } });
    r++;
  };

  wide('GST — E-Way Bill vs GSTR-1 Reconciliation', S.title);
  wide('Auto-generated reconciliation dashboard · all figures in INR', S.subtitle);
  blank();

  wide('📅  PERIOD COVERAGE', S.section);
  kv('GSTR-1 return period (filing fp)', summary.gstrFps.map(periodLabel).join(', ') || '—', { bold: true });
  kv('GSTR-1 invoice-date range', summary.gstrDateRange || '—');
  kv('GSTR-1 periods (by invoice date)', summary.gstrPeriods.map(periodLabel).join(', ') || '—');
  kv('E-Way Bill period(s)', summary.ewbPeriods.map(periodLabel).join(', ') || '—', { bold: true });
  kv('E-Way Bill doc-date range', summary.ewbDateRange || '—');
  kv('Combined span reconciled', summary.periods.map(periodLabel).join(', ') || '—');
  kv('Files uploaded', `${summary.gstrFiles} GSTR-1 JSON · ${summary.ewbFiles} EWB Excel`);
  blank();

  wide('📊  RECONCILIATION RESULT', S.section);
  kv('Unique GSTR-1 documents', summary.uniqueGstrDocs);
  kv('Unique E-Way Bill documents', summary.uniqueEwbDocs);
  kv('Valid EWB rows (after exclusions)', summary.validEwbRows);
  kv('Documents in both', summary.docsInBoth, { bold: true });
  kv('  ✅ Completely matched', summary.completelyMatched, { valStyle: chip(C.green, C.greenLt) });
  kv('  ⚠️ Matched with variance', summary.withVariance, { valStyle: chip(C.amber, C.amberLt) });
  kv('  🔵 Only in E-Way Bill', summary.onlyInEwb, { valStyle: chip(C.red, C.redLt) });
  kv('  🔴 Only in GSTR-1', summary.onlyInGstr, { valStyle: chip(C.red, C.redLt) });
  blank();

  wide('💰  MONEY AT RISK (INR)', S.section);
  kv('Total tax at risk (variances)', summary.totalTaxAtRisk, { valStyle: chip(C.red, C.redLt), z: INR });
  kv('EWB-only tax exposure (under-reporting)', summary.ewbOnlyTaxExposure, { valStyle: chip(C.red, C.redLt), z: INR });
  kv('GSTR-only value likely needing EWB', summary.gstrOnlyMissingEwbValue, { valStyle: chip(C.amber, C.amberLt), z: INR });
  kv('Timing differences (count)', summary.timingDifferenceCount);
  kv('Tax-type (inter/intra) mismatches', summary.taxTypeMismatchCount);
  kv('GSTIN mismatches (count)', summary.gstinMismatchCount);
  blank();

  wide('🚫  EXCLUSIONS', S.section);
  kv('Cancelled EWB rows (excluded)', summary.cancelledEwbRows);
  kv('Delivery-challan rows (excluded)', summary.deliveryChallanRows);
  blank();

  wide('⚙️  CONFIG USED', S.section);
  kv('Assessable tolerance', cfg.assessableTolerance, { z: INR });
  kv('Tax tolerance per head', cfg.taxTolerance, { z: INR });
  kv('EWB threshold', cfg.ewbThreshold, { z: INR });
  kv('Match across periods', cfg.matchAcrossPeriods ? 'Yes' : 'No (period-locked)');
  kv('Use GSTIN in match key', cfg.useGstinInKey ? 'Yes' : 'No');

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 16 }];
  ws['!rows'] = [{ hpt: 26 }, { hpt: 16 }];
  return ws;
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const exportExcel = (summary: SummaryData, report: ReconciliationResult) => {
  const wb = XLSX.utils.book_new();
  const cfg = report.config;

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(summary, cfg), 'Summary');

  const periodHeaders = ['period', 'gstrDocs', 'ewbDocs', 'matched', 'variances', 'gstrOnly', 'ewbOnly', 'taxAtRisk'];
  const periodRows = summary.perPeriod.map((p) => ({ ...p, period: periodLabel(p.period) }));
  XLSX.utils.book_append_sheet(wb, styledSheet(periodRows, periodHeaders), 'Period_Summary');

  const varHeaders = [
    'doc_no', 'ewb_doc_no', 'doc_date', 'ewb_no', 'ewb_date', 'buyer_gstin', 'place_of_supply',
    'category', 'match_confidence', 'gstr_periods', 'ewb_periods', 'remarks',
    'abs_value_at_risk',
    'assessable_var', 'cgst_var', 'sgst_var', 'igst_var', 'total_tax_var',
    'assessable_gstr', 'cgst_gstr', 'sgst_gstr', 'igst_gstr',
    'assessable_ewb', 'cgst_ewb', 'sgst_ewb', 'igst_ewb', 'invoice_value',
  ];
  XLSX.utils.book_append_sheet(wb, styledSheet(report.variances, varHeaders), 'Variances');

  const matchHeaders = [
    'doc_no', 'ewb_doc_no', 'doc_date', 'ewb_no', 'ewb_date', 'buyer_gstin', 'place_of_supply',
    'category', 'match_confidence', 'gstr_periods', 'ewb_periods',
    'invoice_value', 'assessable_gstr', 'cgst_gstr', 'sgst_gstr', 'igst_gstr',
  ];
  XLSX.utils.book_append_sheet(wb, styledSheet(report.completely_matched, matchHeaders), 'Completely_Matched');

  const ewbOnlyHeaders = [
    'doc_no', 'doc_type', 'doc_dates', 'ewb_no', 'ewb_date', 'other_party_gstin',
    'reason', 'ewb_count', 'assessable', 'cgst', 'sgst', 'igst', 'total_tax', 'periods',
  ];
  const ewbOnlyRows = report.ewb_only.map((row) => ({ ...row, periods: row.periods.map(periodLabel).join(', ') }));
  XLSX.utils.book_append_sheet(wb, styledSheet(ewbOnlyRows, ewbOnlyHeaders), 'EWB_Only');

  const gstrOnlyHeaders = [
    'doc_no', 'doc_date', 'buyer_gstin', 'place_of_supply', 'category', 'reason',
    'is_service', 'invoice_value', 'assessable', 'cgst', 'sgst', 'igst', 'total_tax', 'periods',
  ];
  const gstrOnlyRows = report.gstr_only.map((row) => ({ ...row, periods: row.periods.map(periodLabel).join(', ') }));
  XLSX.utils.book_append_sheet(wb, styledSheet(gstrOnlyRows, gstrOnlyHeaders), 'GSTR_Only');

  const cancelWs = report.cancelled_ewb.length
    ? styledSheet(report.cancelled_ewb.map((d) => d.raw), Object.keys(report.cancelled_ewb[0].raw))
    : XLSX.utils.aoa_to_sheet([['No cancelled E-Way Bills found.']]);
  XLSX.utils.book_append_sheet(wb, cancelWs, 'Cancelled_EWB');

  const dcWs = report.delivery_challans.length
    ? styledSheet(report.delivery_challans.map((d) => d.raw), Object.keys(report.delivery_challans[0].raw))
    : XLSX.utils.aoa_to_sheet([['No delivery challans found.']]);
  XLSX.utils.book_append_sheet(wb, dcWs, 'Delivery_Challans');

  if (report.warnings.length) {
    const warnWs = XLSX.utils.aoa_to_sheet([['Warnings / data-quality notes'], ...report.warnings.map((w) => [w])]);
    warnWs['!cols'] = [{ wch: 90 }];
    const a = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (warnWs[a]) warnWs[a].s = S.section;
    XLSX.utils.book_append_sheet(wb, warnWs, 'Warnings');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'EWB_GSTR1_Reconciliation.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
