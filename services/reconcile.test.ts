import { describe, it, expect, beforeAll } from 'vitest';
import XLSXpkg from 'xlsx-js-style';
import { reconcile } from './reconcile';
import type { Gstr1File } from '../types';

// The engine reads e-way bill files through a global `XLSX` (bundled). Tests build
// e-way bill inputs as the GST-portal HTML-<table>-in-.xls format the parser expects.
beforeAll(() => {
  (globalThis as any).XLSX = (XLSXpkg as any).utils ? XLSXpkg : (XLSXpkg as any).default;
});

// Build a UTF-8 ArrayBuffer of an HTML table the EWB parser understands.
const ewbHtml = (rows: Record<string, string | number>[]): ArrayBuffer => {
  const cols = ['Status', 'Doc Type', 'Doc No', 'Doc Date', 'Assessable Value', 'CGST Value', 'SGST Value', 'IGST Value', 'Other Party GSTIN', 'EWB No', 'EWB Date'];
  const head = `<tr>${cols.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('');
  const html = `<table>${head}${body}</table>`;
  return new TextEncoder().encode(html).buffer;
};

const gstr = (fp: string, invs: { no: string; date: string; gstin: string; ass: number; igst?: number; cgst?: number; sgst?: number; hsn?: string }[]): Gstr1File => ({
  gstin: '29AAXCS2197N1Z4', fp,
  b2b: invs.map((i) => ({
    ctin: i.gstin,
    inv: [{ inum: i.no, idt: i.date, val: i.ass + (i.igst ?? 0) + (i.cgst ?? 0) + (i.sgst ?? 0), pos: i.gstin.slice(0, 2),
      itms: [{ num: 1, itm_det: { txval: i.ass, iamt: i.igst ?? 0, camt: i.cgst ?? 0, samt: i.sgst ?? 0, hsn_sc: i.hsn ?? '8541' } }] }],
  })),
});

describe('reconcile engine — golden cases', () => {
  it('exact match on same doc-no + value ties clean', () => {
    const g = gstr('042026', [{ no: '90000001', date: '10-04-2026', gstin: '27AABCU9005B1ZY', ass: 500000, igst: 90000 }]);
    const e = ewbHtml([{ Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '90000001', 'Doc Date': '10/04/2026', 'Assessable Value': 500000, 'IGST Value': 90000, 'Other Party GSTIN': '27AABCU9005B1ZY' }]);
    const { summary } = reconcile([g], [e], {});
    expect(summary.completelyMatched).toBe(1);
    expect(summary.withVariance).toBe(0);
  });

  it('trailing-dash doc-no does NOT merge/sum with the plain doc-no (collision fix)', () => {
    // Two distinct EWB documents that normalise alike; value-aware match must pick the tie.
    const g = gstr('022026', [{ no: '90003639', date: '28-02-2026', gstin: '24AAACL0140P7ZJ', ass: 11154000, igst: 557700 }]);
    const e = ewbHtml([
      { Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '90003639', 'Doc Date': '28/02/2026', 'Assessable Value': 12786258, 'IGST Value': 639312, 'Other Party GSTIN': '24AAACL0140P7ZJ' },
      { Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '90003639-', 'Doc Date': '28/02/2026', 'Assessable Value': 11154000, 'IGST Value': 557700, 'Other Party GSTIN': '24AAACL0140P7ZJ' },
    ]);
    const { summary, reportData } = reconcile([g], [e], {});
    // Must match the value-tied dash variant cleanly, NOT sum to 23.9M.
    expect(summary.completelyMatched).toBe(1);
    const matched = reportData.completely_matched[0];
    expect(Math.round(matched.assessable_ewb)).toBe(11154000);
  });

  it('EWB in a month with no GSTR-1 uploaded is timing, not omission', () => {
    const g = gstr('042026', [{ no: '90000010', date: '10-04-2026', gstin: '27AABCU9005B1ZY', ass: 500000, igst: 90000 }]);
    // Extra EWB dated in March — no March GSTR-1 provided.
    const e = ewbHtml([
      { Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '90000010', 'Doc Date': '10/04/2026', 'Assessable Value': 500000, 'IGST Value': 90000, 'Other Party GSTIN': '27AABCU9005B1ZY' },
      { Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '89999999', 'Doc Date': '15/03/2026', 'Assessable Value': 300000, 'IGST Value': 54000, 'Other Party GSTIN': '27AABCU9005B1ZY' },
    ]);
    const { reportData } = reconcile([g], [e], {});
    const timing = reportData.ewb_only.find((r) => r.reason.includes('no GSTR-1 uploaded'));
    expect(timing).toBeTruthy();
    // The genuine-omission exposure excludes timing rows.
    expect(reportData.ewb_only.filter((r) => r.reason.startsWith('Not reported')).length).toBe(0);
  });

  it('below-threshold GSTR invoice needs no EWB', () => {
    const g = gstr('042026', [{ no: '90000020', date: '10-04-2026', gstin: '27AABCU9005B1ZY', ass: 40000, igst: 7200 }]);
    const { reportData } = reconcile([g], [ewbHtml([])], {});
    expect(reportData.gstr_only[0].reason).toContain('Below EWB threshold');
  });

  it('recipient/ex-works: buyer with no supplier EWB anywhere', () => {
    const g = gstr('042026', [
      { no: '90000030', date: '10-04-2026', gstin: '27AABCU9005B1ZY', ass: 500000, igst: 90000 }, // will match
      { no: '90000031', date: '11-04-2026', gstin: '29AAMFE1000A1Z6', ass: 600000, igst: 108000 }, // buyer never in EWB
    ]);
    const e = ewbHtml([{ Status: 'Active', 'Doc Type': 'Tax Invoice', 'Doc No': '90000030', 'Doc Date': '10/04/2026', 'Assessable Value': 500000, 'IGST Value': 90000, 'Other Party GSTIN': '27AABCU9005B1ZY' }]);
    const { reportData } = reconcile([g], [e], {});
    const ex = reportData.gstr_only.find((r) => r.doc_no === '90000031');
    expect(ex?.reason).toContain('recipient/transporter');
  });

  it('cancelled + delivery-challan EWBs are excluded from matching', () => {
    const g = gstr('042026', [{ no: '90000040', date: '10-04-2026', gstin: '27AABCU9005B1ZY', ass: 500000, igst: 90000 }]);
    const e = ewbHtml([
      { Status: 'Cancelled', 'Doc Type': 'Tax Invoice', 'Doc No': '90000040', 'Doc Date': '10/04/2026', 'Assessable Value': 500000, 'IGST Value': 90000, 'Other Party GSTIN': '27AABCU9005B1ZY' },
      { Status: 'Active', 'Doc Type': 'Delivery Challan', 'Doc No': 'DC/1', 'Doc Date': '10/04/2026', 'Assessable Value': 500000, 'Other Party GSTIN': '27AABCU9005B1ZY' },
    ]);
    const { summary } = reconcile([g], [e], {});
    expect(summary.cancelledEwbRows).toBe(1);
    expect(summary.deliveryChallanRows).toBe(1);
    expect(summary.completelyMatched).toBe(0);
  });
});
