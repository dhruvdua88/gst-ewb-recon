import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from './utils';

declare const XLSX: any; // from CDN

const fmtMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const autoWidth = (ws: any) => {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const widths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let w = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length + (R === 0 ? 3 : 1);
        if (len > w) w = len;
      }
    }
    widths[C] = Math.min(w, 60);
  }
  ws['!cols'] = widths.map((wch) => ({ wch }));
  // bold header row
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ c: C, r: 0 })];
    if (cell) cell.s = { font: { bold: true } };
  }
};

const sheetFromRows = (rows: any[], headers: string[]) => {
  const data = rows.map((r) => {
    const o: Record<string, any> = {};
    headers.forEach((h) => {
      const v = r[h];
      o[h] = typeof v === 'number' ? fmtMoney(v) : v ?? null;
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [Object.fromEntries(headers.map((h) => [h, null]))], { header: headers });
  autoWidth(ws);
  return ws;
};

export const exportExcel = (summary: SummaryData, report: ReconciliationResult) => {
  const wb = XLSX.utils.book_new();
  const cfg = report.config;

  // 1. Summary
  const summaryAoa: any[][] = [
    ['GST — E-Way Bill vs GSTR-1 Reconciliation'],
    ['Periods covered', summary.periods.map(periodLabel).join(', ') || '—'],
    ['GSTR-1 files', summary.gstrFiles],
    ['E-Way Bill files', summary.ewbFiles],
    [],
    ['Metric', 'Count'],
    ['Valid EWB rows (after exclusions)', summary.validEwbRows],
    ['Unique EWB documents', summary.uniqueEwbDocs],
    ['Unique GSTR-1 documents', summary.uniqueGstrDocs],
    [],
    ['Documents in both', summary.docsInBoth],
    ['  Completely matched', summary.completelyMatched],
    ['  Matched with variance', summary.withVariance],
    ['Only in E-Way Bill', summary.onlyInEwb],
    ['Only in GSTR-1', summary.onlyInGstr],
    [],
    ['Cancelled EWB rows (excluded)', summary.cancelledEwbRows],
    ['Delivery challan rows (excluded)', summary.deliveryChallanRows],
    [],
    ['ACTIONABLE FIGURES (INR)', ''],
    ['Total tax at risk (variances)', fmtMoney(summary.totalTaxAtRisk)],
    ['EWB-only tax exposure (possible under-reporting)', fmtMoney(summary.ewbOnlyTaxExposure)],
    ['GSTR-only value likely needing EWB', fmtMoney(summary.gstrOnlyMissingEwbValue)],
    ['Timing differences (count)', summary.timingDifferenceCount],
    ['Tax-type (inter/intra) mismatches (count)', summary.taxTypeMismatchCount],
    ['GSTIN mismatches (count)', summary.gstinMismatchCount],
    [],
    ['CONFIG USED', ''],
    ['Assessable tolerance (INR)', cfg.assessableTolerance],
    ['Tax tolerance per head (INR)', cfg.taxTolerance],
    ['EWB threshold (INR)', cfg.ewbThreshold],
    ['Match across periods', cfg.matchAcrossPeriods ? 'Yes' : 'No (period-locked)'],
    ['Use GSTIN in match key', cfg.useGstinInKey ? 'Yes' : 'No'],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  autoWidth(summaryWs);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // 2. Period summary
  const periodHeaders = ['period', 'gstrDocs', 'ewbDocs', 'matched', 'variances', 'gstrOnly', 'ewbOnly', 'taxAtRisk'];
  const periodRows = summary.perPeriod.map((p) => ({ ...p, period: periodLabel(p.period) }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(periodRows, periodHeaders), 'Period_Summary');

  // 3. Variances (already sorted by value at risk)
  const varHeaders = [
    'doc_no', 'ewb_doc_no', 'doc_date', 'ewb_no', 'ewb_date', 'buyer_gstin', 'place_of_supply',
    'category', 'match_confidence', 'gstr_periods', 'ewb_periods', 'remarks',
    'abs_value_at_risk',
    'assessable_var', 'cgst_var', 'sgst_var', 'igst_var', 'total_tax_var',
    'assessable_gstr', 'cgst_gstr', 'sgst_gstr', 'igst_gstr',
    'assessable_ewb', 'cgst_ewb', 'sgst_ewb', 'igst_ewb', 'invoice_value',
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(report.variances, varHeaders), 'Variances');

  // 4. Completely matched
  const matchHeaders = [
    'doc_no', 'ewb_doc_no', 'doc_date', 'ewb_no', 'ewb_date', 'buyer_gstin', 'place_of_supply',
    'category', 'match_confidence', 'gstr_periods', 'ewb_periods',
    'invoice_value', 'assessable_gstr', 'cgst_gstr', 'sgst_gstr', 'igst_gstr',
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(report.completely_matched, matchHeaders), 'Completely_Matched');

  // 5. EWB only (possible omissions)
  const ewbOnlyHeaders = [
    'doc_no', 'doc_type', 'doc_dates', 'ewb_no', 'ewb_date', 'other_party_gstin',
    'reason', 'ewb_count', 'assessable', 'cgst', 'sgst', 'igst', 'total_tax', 'periods',
  ];
  const ewbOnlyRows = report.ewb_only.map((r) => ({ ...r, periods: r.periods.map(periodLabel).join(', ') }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(ewbOnlyRows, ewbOnlyHeaders), 'EWB_Only');

  // 6. GSTR only
  const gstrOnlyHeaders = [
    'doc_no', 'doc_date', 'buyer_gstin', 'place_of_supply', 'category', 'reason',
    'is_service', 'invoice_value', 'assessable', 'cgst', 'sgst', 'igst', 'total_tax', 'periods',
  ];
  const gstrOnlyRows = report.gstr_only.map((r) => ({ ...r, periods: r.periods.map(periodLabel).join(', ') }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(gstrOnlyRows, gstrOnlyHeaders), 'GSTR_Only');

  // 7. Cancelled EWB
  const cancelWs = report.cancelled_ewb.length
    ? (() => { const ws = XLSX.utils.json_to_sheet(report.cancelled_ewb.map((d) => d.raw)); autoWidth(ws); return ws; })()
    : XLSX.utils.aoa_to_sheet([['No cancelled E-Way Bills found.']]);
  XLSX.utils.book_append_sheet(wb, cancelWs, 'Cancelled_EWB');

  // 8. Delivery challans
  const dcWs = report.delivery_challans.length
    ? (() => { const ws = XLSX.utils.json_to_sheet(report.delivery_challans.map((d) => d.raw)); autoWidth(ws); return ws; })()
    : XLSX.utils.aoa_to_sheet([['No delivery challans found.']]);
  XLSX.utils.book_append_sheet(wb, dcWs, 'Delivery_Challans');

  // 9. Warnings
  if (report.warnings.length) {
    const warnWs = XLSX.utils.aoa_to_sheet([['Warnings / data-quality notes'], ...report.warnings.map((w) => [w])]);
    autoWidth(warnWs);
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
