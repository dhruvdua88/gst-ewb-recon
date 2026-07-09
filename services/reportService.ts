import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from './utils';

const inr = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => (n || 0).toLocaleString('en-IN');

// Email clients (Gmail/Outlook) strip <head><style> and ignore flexbox, so this
// report is built table-based with every style INLINE. A <style> block is kept
// only as progressive enhancement for clients that honour it (Apple Mail).
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "Consolas,'Courier New',monospace";

const TH = `padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;text-align:left;`;
const THR = TH + 'text-align:right;';
const TD = `padding:8px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#334155;text-align:left;`;
const TDR = TD + `text-align:right;font-family:${MONO};`;

export const generateHtmlReport = (summary: SummaryData, report: ReconciliationResult): string => {
  const reportDate = new Date().toUTCString();
  const cfg = report.config;

  const topVariances = report.variances.slice(0, 10);
  const topEwbOnly = report.ewb_only.filter((r) => r.reason.startsWith('Not reported')).slice(0, 10);
  const topGstrOnly = report.gstr_only.filter((r) => r.reason.startsWith('EWB likely')).slice(0, 10);

  const h2 = (t: string) =>
    `<h2 style="font-size:17px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:26px 0 12px;font-family:${FONT};">${t}</h2>`;

  const card = (value: string, label: string, color = '#4338ca') => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-family:${FONT};">
          <div style="font-size:19px;font-weight:700;color:${color};font-family:${MONO};">${value}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${label}</div>
        </td></tr>
      </table>
    </td>`;

  const cardGrid = (cards: string[]) => {
    let rows = '';
    for (let i = 0; i < cards.length; i += 2) {
      rows += `<tr>${cards[i] || '<td width="50%"></td>'}${cards[i + 1] || '<td width="50%"></td>'}</tr>`;
    }
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
  };

  const coverageCard = (title: string, line1: string, line2: string, foot: string, accent: string, bg: string) => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-family:${FONT};">
          <div style="font-size:11px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:.4px;">${title}</div>
          <div style="font-size:13px;color:#334155;margin-top:5px;">${line1}</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">${line2}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">${foot}</div>
        </td></tr>
      </table>
    </td>`;

  const pill = (t: string) =>
    `<span style="display:inline-block;background:#eef2ff;color:#4338ca;border-radius:20px;padding:3px 11px;font-size:11px;margin:2px;font-family:${FONT};">${t}</span>`;

  const dataTable = (head: string, body: string) =>
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;">${head}${body}</table>`;

  const emptyRow = (cols: number, text: string) =>
    `<tr><td colspan="${cols}" style="${TD}text-align:center;color:#94a3b8;padding:14px;">${text}</td></tr>`;

  const periodRows = summary.perPeriod.map((p) => `
    <tr>
      <td style="${TD}">${periodLabel(p.period)}</td>
      <td style="${TDR}">${num(p.gstrDocs)}</td>
      <td style="${TDR}">${num(p.ewbDocs)}</td>
      <td style="${TDR}">${num(p.matched)}</td>
      <td style="${TDR}">${num(p.variances)}</td>
      <td style="${TDR}">${num(p.gstrOnly)}</td>
      <td style="${TDR}">${num(p.ewbOnly)}</td>
      <td style="${TDR}">${inr(p.taxAtRisk)}</td>
    </tr>`).join('') || emptyRow(8, 'No periods');

  const varRows = topVariances.map((r) => `
    <tr>
      <td style="${TD}">${r.doc_no}</td><td style="${TD}">${r.buyer_gstin}</td><td style="${TD}">${r.remarks}</td>
      <td style="${TDR}">${inr(r.assessable_var)}</td>
      <td style="${TDR}">${inr(r.total_tax_var)}</td>
    </tr>`).join('') || emptyRow(5, 'No variances 🎉');

  const ewbRows = topEwbOnly.map((r) => `
    <tr>
      <td style="${TD}">${r.doc_no}</td><td style="${TD}">${r.other_party_gstin || '—'}</td>
      <td style="${TDR}">${inr(r.assessable)}</td><td style="${TDR}">${inr(r.total_tax)}</td>
    </tr>`).join('') || emptyRow(4, 'None');

  const gstrRows = topGstrOnly.map((r) => `
    <tr>
      <td style="${TD}">${r.doc_no}</td><td style="${TD}">${r.buyer_gstin}</td>
      <td style="${TDR}">${inr(r.invoice_value)}</td><td style="${TDR}">${inr(r.assessable)}</td>
    </tr>`).join('') || emptyRow(4, 'None');

  const action = (n: string, title: string, body: string) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-top:10px;">
      <tr><td style="padding:14px 16px;font-family:${FONT};">
        <div style="font-size:15px;font-weight:700;color:#b45309;margin-bottom:6px;">${n}. ${title}</div>
        <div style="font-size:13px;line-height:1.6;color:#334155;">${body}</div>
      </td></tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EWB vs GSTR-1 Reconciliation Report</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;}
  table{mso-table-lspace:0;mso-table-rspace:0;}
</style></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT};color:#334155;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
  <tr><td align="center" style="padding:20px 12px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">

      <!-- Header -->
      <tr><td style="background:#4338ca;padding:26px 30px;font-family:${FONT};">
        <div style="font-size:23px;font-weight:700;color:#ffffff;">E-Way Bill vs GSTR-1 Reconciliation</div>
        <div style="font-size:12px;color:#ffffff;opacity:.85;margin-top:4px;">Generated ${reportDate}</div>
      </td></tr>

      <tr><td style="padding:20px 30px 28px;font-family:${FONT};">

        ${h2('📅 Period Coverage')}
        ${cardGrid([
          coverageCard(
            'GSTR-1 JSON',
            `Return period: <strong>${summary.gstrFps.map(periodLabel).join(', ') || '—'}</strong>`,
            `Invoice dates: ${summary.gstrDateRange || '—'}`,
            `${summary.gstrFiles} file(s) · ${num(summary.uniqueGstrDocs)} docs`,
            '#4338ca', '#eef2ff'),
          coverageCard(
            'E-Way Bill Excel',
            `Period(s): <strong>${summary.ewbPeriods.map(periodLabel).join(', ') || '—'}</strong>`,
            `Doc dates: ${summary.ewbDateRange || '—'}`,
            `${summary.ewbFiles} file(s) · ${num(summary.validEwbRows)} valid rows`,
            '#15803d', '#f0fdf4'),
        ])}

        ${summary.ewbFileLikelyIncomplete ? `
        <div style="margin:14px 0;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
          <div style="font-weight:700;color:#991b1b;font-size:13px;">⚠️ E-Way Bill file looks incomplete — read before acting</div>
          <div style="font-size:12px;color:#b91c1c;line-height:1.5;margin-top:4px;">
            ${num(summary.gstrMissingEwbCount)} taxable goods invoices (${inr(summary.gstrOnlyMissingEwbValue)} assessable)
            have no matching e-way bill — only ${Math.round(summary.ewbCoverageRatio * 100)}% of EWB-requiring invoices matched.
            This usually means the EWB export did not cover the full period. Re-export the complete e-way bill list
            (all sub-users) for the exact return period and re-run before treating the figure below as a compliance gap.
          </div>
        </div>` : ''}
        ${summary.ewbOnlyTimingCount ? `
        <div style="margin:14px 0;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;line-height:1.5;">
          <strong>${num(summary.ewbOnlyTimingCount)}</strong> EWB-only document(s) worth
          <strong>${inr(summary.ewbOnlyTimingValue)}</strong> are timing items (invoice dated in a month whose GSTR-1
          was not uploaded) and are excluded from the “EWB-only tax exposure” below — they are reported in that month’s own GSTR-1.
        </div>` : ''}

        ${h2('💰 Money at a Glance')}
        ${cardGrid([
          card(inr(summary.totalTaxAtRisk), 'Tax at risk (matched variances)', '#b91c1c'),
          card(inr(summary.ewbOnlyTaxExposure), 'EWB-only tax exposure (genuine, ex-timing)', '#b91c1c'),
          card(inr(summary.gstrOnlyMissingEwbValue), 'GSTR value likely needing an EWB', '#4338ca'),
          card(num(summary.completelyMatched), 'Documents matched clean', '#15803d'),
        ])}

        ${h2('📊 Counts')}
        ${cardGrid([
          card(num(summary.docsInBoth), 'In both sources'),
          card(num(summary.withVariance), 'With variance', '#b45309'),
          card(num(summary.onlyInEwb), 'Only in EWB', '#b91c1c'),
          card(num(summary.onlyInGstr), 'Only in GSTR-1', '#b91c1c'),
        ])}
        <div style="margin-top:10px;">
          ${pill(`Timing diffs: ${num(summary.timingDifferenceCount)}`)}
          ${pill(`Tax-type mismatches: ${num(summary.taxTypeMismatchCount)}`)}
          ${pill(`GSTIN mismatches: ${num(summary.gstinMismatchCount)}`)}
          ${pill(`Cancelled EWB: ${num(summary.cancelledEwbRows)}`)}
          ${pill(`Delivery challans: ${num(summary.deliveryChallanRows)}`)}
        </div>

        ${h2('Period-wise Position')}
        ${dataTable(
          `<tr><th style="${TH}">Period</th><th style="${THR}">GSTR docs</th><th style="${THR}">EWB docs</th><th style="${THR}">Matched</th><th style="${THR}">Variances</th><th style="${THR}">GSTR only</th><th style="${THR}">EWB only</th><th style="${THR}">Tax at risk</th></tr>`,
          periodRows)}

        ${h2('Top Variances (by value at risk)')}
        ${dataTable(
          `<tr><th style="${TH}">Doc No</th><th style="${TH}">Buyer GSTIN</th><th style="${TH}">Nature</th><th style="${THR}">Assessable Δ</th><th style="${THR}">Tax Δ</th></tr>`,
          varRows)}

        ${h2('Top EWB-only — possible under-reporting in GSTR-1')}
        ${dataTable(
          `<tr><th style="${TH}">Doc No</th><th style="${TH}">Other party GSTIN</th><th style="${THR}">Assessable</th><th style="${THR}">Tax</th></tr>`,
          ewbRows)}

        ${h2('Top GSTR-only — EWB likely required but not found')}
        ${dataTable(
          `<tr><th style="${TH}">Doc No</th><th style="${TH}">Buyer GSTIN</th><th style="${THR}">Invoice value</th><th style="${THR}">Assessable</th></tr>`,
          gstrRows)}

        ${h2('Recommended Actions')}
        ${action('1', 'Close the variances', `Work the <strong>Variances</strong> sheet top-down (pre-sorted by money at risk: ${inr(summary.totalTaxAtRisk)} of tax). Fix tax-type (IGST vs CGST+SGST) and GSTIN mismatches first — they often signal wrong place-of-supply.`)}
        ${action('2', 'Investigate EWB-only documents', `${num(summary.onlyInEwb)} EWBs (${inr(summary.ewbOnlyTaxExposure)} tax) have no matching GSTR-1 entry. Confirm these supplies are reported — unreported outward supplies are an under-reporting exposure. Timing items clear once the later period's GSTR-1 is filed.`)}
        ${action('3', 'Check GSTR-only above threshold', `${num(report.gstr_only.filter((r) => r.reason.startsWith('EWB likely')).length)} invoices above the ₹${num(cfg.ewbThreshold)} EWB threshold have no E-Way Bill. Verify an EWB was generated (non-generation carries penalty under Rule 138).`)}

        ${report.warnings.length ? `${h2('Data-quality notes')}<ul style="font-size:12px;color:#64748b;line-height:1.6;padding-left:20px;">${report.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;font-family:${FONT};">
        Generated by gst-ewb-recon &middot; Tolerances: assessable ₹${num(cfg.assessableTolerance)}, tax ₹${num(cfg.taxTolerance)}/head &middot; Match ${cfg.matchAcrossPeriods ? 'across periods' : 'period-locked'}
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
};
