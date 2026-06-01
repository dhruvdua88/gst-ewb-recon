import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from './utils';

const inr = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => (n || 0).toLocaleString('en-IN');

export const generateHtmlReport = (summary: SummaryData, report: ReconciliationResult): string => {
  const reportDate = new Date().toUTCString();
  const cfg = report.config;

  const topVariances = report.variances.slice(0, 10);
  const topEwbOnly = report.ewb_only.filter((r) => r.reason.startsWith('Not reported')).slice(0, 10);
  const topGstrOnly = report.gstr_only.filter((r) => r.reason.startsWith('EWB likely')).slice(0, 10);

  const periodRows = summary.perPeriod.map((p) => `
    <tr>
      <td>${periodLabel(p.period)}</td>
      <td class="r">${num(p.gstrDocs)}</td>
      <td class="r">${num(p.ewbDocs)}</td>
      <td class="r">${num(p.matched)}</td>
      <td class="r">${num(p.variances)}</td>
      <td class="r">${num(p.gstrOnly)}</td>
      <td class="r">${num(p.ewbOnly)}</td>
      <td class="r">${inr(p.taxAtRisk)}</td>
    </tr>`).join('');

  const varRows = topVariances.map((r) => `
    <tr>
      <td>${r.doc_no}</td><td>${r.buyer_gstin}</td><td>${r.remarks}</td>
      <td class="r">${inr(r.assessable_var)}</td>
      <td class="r">${inr(r.total_tax_var)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">No variances 🎉</td></tr>`;

  const ewbRows = topEwbOnly.map((r) => `
    <tr>
      <td>${r.doc_no}</td><td>${r.other_party_gstin || '—'}</td>
      <td class="r">${inr(r.assessable)}</td><td class="r">${inr(r.total_tax)}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">None</td></tr>`;

  const gstrRows = topGstrOnly.map((r) => `
    <tr>
      <td>${r.doc_no}</td><td>${r.buyer_gstin}</td>
      <td class="r">${inr(r.invoice_value)}</td><td class="r">${inr(r.assessable)}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">None</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EWB vs GSTR-1 Reconciliation Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f1f5f9;color:#334155}
  .wrap{max-width:880px;margin:20px auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.06)}
  .hd{background:#4338ca;color:#fff;padding:28px 32px}
  .hd h1{margin:0;font-size:24px}.hd p{margin:4px 0 0;font-size:13px;opacity:.85}
  .body{padding:24px 32px}
  h2{font-size:18px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:28px 0 14px}
  .cards{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
  .card{flex:1;min-width:160px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
  .card .v{font-size:22px;font-weight:700;color:#4338ca;font-family:Consolas,monospace}
  .card .l{font-size:12px;color:#64748b;margin-top:4px}
  .card.risk .v{color:#b91c1c}.card.ok .v{color:#15803d}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef2f7}
  th{background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
  td.r,th.r{text-align:right;font-family:Consolas,monospace}
  .empty{text-align:center;color:#94a3b8;padding:14px}
  .act{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-top:12px}
  .act h3{margin:0 0 6px;font-size:15px;color:#b45309}.act p{margin:0;font-size:13px;line-height:1.6}
  .ft{text-align:center;padding:18px;font-size:11px;color:#94a3b8;background:#f8fafc}
  .pill{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:20px;padding:2px 10px;font-size:11px;margin:2px}
</style></head>
<body><div class="wrap">
  <div class="hd">
    <h1>E-Way Bill vs GSTR-1 Reconciliation</h1>
    <p>Generated ${reportDate} &middot; Periods: ${summary.periods.map(periodLabel).join(', ') || '—'}</p>
  </div>
  <div class="body">

    <h2>Money at a Glance</h2>
    <div class="cards">
      <div class="card risk"><div class="v">${inr(summary.totalTaxAtRisk)}</div><div class="l">Tax at risk (matched variances)</div></div>
      <div class="card risk"><div class="v">${inr(summary.ewbOnlyTaxExposure)}</div><div class="l">EWB-only tax exposure (possible under-reporting)</div></div>
      <div class="card"><div class="v">${inr(summary.gstrOnlyMissingEwbValue)}</div><div class="l">GSTR value likely needing an EWB</div></div>
      <div class="card ok"><div class="v">${num(summary.completelyMatched)}</div><div class="l">Documents matched clean</div></div>
    </div>

    <h2>Counts</h2>
    <div class="cards">
      <div class="card"><div class="v">${num(summary.docsInBoth)}</div><div class="l">In both sources</div></div>
      <div class="card"><div class="v">${num(summary.withVariance)}</div><div class="l">With variance</div></div>
      <div class="card"><div class="v">${num(summary.onlyInEwb)}</div><div class="l">Only in EWB</div></div>
      <div class="card"><div class="v">${num(summary.onlyInGstr)}</div><div class="l">Only in GSTR-1</div></div>
    </div>
    <p style="margin-top:10px">
      <span class="pill">Timing diffs: ${num(summary.timingDifferenceCount)}</span>
      <span class="pill">Tax-type mismatches: ${num(summary.taxTypeMismatchCount)}</span>
      <span class="pill">GSTIN mismatches: ${num(summary.gstinMismatchCount)}</span>
      <span class="pill">Cancelled EWB: ${num(summary.cancelledEwbRows)}</span>
      <span class="pill">Delivery challans: ${num(summary.deliveryChallanRows)}</span>
    </p>

    <h2>Period-wise Position</h2>
    <table>
      <thead><tr><th>Period</th><th class="r">GSTR docs</th><th class="r">EWB docs</th><th class="r">Matched</th><th class="r">Variances</th><th class="r">GSTR only</th><th class="r">EWB only</th><th class="r">Tax at risk</th></tr></thead>
      <tbody>${periodRows || `<tr><td colspan="8" class="empty">No periods</td></tr>`}</tbody>
    </table>

    <h2>Top Variances (by value at risk)</h2>
    <table>
      <thead><tr><th>Doc No</th><th>Buyer GSTIN</th><th>Nature</th><th class="r">Assessable Δ</th><th class="r">Tax Δ</th></tr></thead>
      <tbody>${varRows}</tbody>
    </table>

    <h2>Top EWB-only — possible under-reporting in GSTR-1</h2>
    <table>
      <thead><tr><th>Doc No</th><th>Other party GSTIN</th><th class="r">Assessable</th><th class="r">Tax</th></tr></thead>
      <tbody>${ewbRows}</tbody>
    </table>

    <h2>Top GSTR-only — EWB likely required but not found</h2>
    <table>
      <thead><tr><th>Doc No</th><th>Buyer GSTIN</th><th class="r">Invoice value</th><th class="r">Assessable</th></tr></thead>
      <tbody>${gstrRows}</tbody>
    </table>

    <h2>Recommended Actions</h2>
    <div class="act"><h3>1. Close the variances</h3><p>Work the <strong>Variances</strong> sheet top-down (it is pre-sorted by money at risk: ${inr(summary.totalTaxAtRisk)} of tax). Fix tax-type (IGST vs CGST+SGST) and GSTIN mismatches first — they often signal wrong place-of-supply.</p></div>
    <div class="act"><h3>2. Investigate EWB-only documents</h3><p>${num(summary.onlyInEwb)} EWBs (${inr(summary.ewbOnlyTaxExposure)} tax) have no matching GSTR-1 entry. Confirm these supplies are reported — unreported outward supplies are an under-reporting exposure. Timing items will clear once the later period's GSTR-1 is filed.</p></div>
    <div class="act"><h3>3. Check GSTR-only above threshold</h3><p>${num(report.gstr_only.filter(r=>r.reason.startsWith('EWB likely')).length)} invoices above the ₹${num(cfg.ewbThreshold)} EWB threshold have no E-Way Bill. Verify an EWB was generated (non-generation carries penalty under Rule 138).</p></div>

    ${report.warnings.length ? `<h2>Data-quality notes</h2><ul>${report.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}
  </div>
  <div class="ft">Generated by gst-ewb-recon &middot; Tolerances: assessable ₹${num(cfg.assessableTolerance)}, tax ₹${num(cfg.taxTolerance)}/head &middot; Match ${cfg.matchAcrossPeriods ? 'across periods' : 'period-locked'}</div>
</div></body></html>`;
};
