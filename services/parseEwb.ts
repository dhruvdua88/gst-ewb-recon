import type { ParsedEwbDoc } from '../types';
import { parseNumber, formatDate, periodFromDate, normalizeGstin } from './utils';

declare const XLSX: any; // from CDN

type ColMap = Record<string, number>;

// Each logical field maps to a list of header substrings (lower-cased) to look for,
// tried in order. First hit wins.
const FIELD_SYNONYMS: Record<string, string[]> = {
  status: ['status'],
  docType: ['doc type', 'doc. type', 'document type', 'doctype'],
  docNo: ['doc no', 'doc. no', 'document no', 'docno', 'invoice no'],
  docDate: ['doc date', 'doc. date', 'document date', 'docdate', 'invoice date'],
  assessable: ['assessable', 'taxable value', 'taxable'],
  cgst: ['cgst'],
  sgst: ['sgst'],
  igst: ['igst'],
  cess: ['cess'],
  ewbNo: ['eway bill no', 'e-way bill no', 'ewb no', 'eway bill number'],
  ewbDate: ['eway bill date', 'e-way bill date', 'ewb date', 'generated date'],
  otherGstin: ['other party gstin', 'gstin of other party', 'recipient gstin', 'buyer gstin', 'gstin'],
  supplyType: ['supply type', 'supplytype'],
};

const buildColMap = (headers: string[]): ColMap => {
  const lower = headers.map((h) => String(h || '').toLowerCase().trim());
  const map: ColMap = {};
  for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
    let idx = -1;
    for (const syn of syns) {
      idx = lower.findIndex((h) => h.includes(syn));
      if (idx !== -1) break;
    }
    map[field] = idx;
  }
  return map;
};

/** Some EWB exports carry a banner row before the real header. Find the header row. */
const findHeaderRow = (rows: any[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].map((c) => String(c || '').toLowerCase()).join('|');
    if (joined.includes('doc') && (joined.includes('assessable') || joined.includes('eway'))) {
      return i;
    }
  }
  return 0;
};

export const parseEwbFiles = (
  buffers: ArrayBuffer[]
): { docs: ParsedEwbDoc[]; warnings: string[] } => {
  const docs: ParsedEwbDoc[] = [];
  const warnings: string[] = [];

  buffers.forEach((buf, fileIdx) => {
    let workbook: any;
    try {
      workbook = XLSX.read(buf, { type: 'array', cellDates: true });
    } catch {
      warnings.push(`E-Way Bill file #${fileIdx + 1} could not be read as Excel — skipped.`);
      return;
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (grid.length < 2) {
      warnings.push(`E-Way Bill file #${fileIdx + 1} appears empty — skipped.`);
      return;
    }

    const hRow = findHeaderRow(grid);
    const headers = grid[hRow].map((h) => String(h ?? ''));
    const col = buildColMap(headers);

    if (col.docNo === -1) {
      warnings.push(`E-Way Bill file #${fileIdx + 1}: no "Document No" column found — skipped.`);
      return;
    }

    const at = (row: any[], field: string) =>
      col[field] !== -1 ? row[col[field]] : null;

    for (let r = hRow + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.every((c) => c === null || c === '')) continue;

      const raw: Record<string, any> = {};
      headers.forEach((h, i) => {
        const v = row[i];
        raw[h || `col${i}`] = v instanceof Date ? formatDate(v) : v;
      });

      const docNo = String(at(row, 'docNo') ?? '').trim();
      if (!docNo) continue; // skip total/footer rows with no doc no

      const docDate = formatDate(at(row, 'docDate'));
      const doc: ParsedEwbDoc = {
        doc_no: docNo,
        doc_date: docDate,
        period: periodFromDate(docDate),
        doc_type: String(at(row, 'docType') ?? '').trim(),
        status: String(at(row, 'status') ?? '').trim(),
        other_party_gstin: normalizeGstin(at(row, 'otherGstin')),
        supply_type: String(at(row, 'supplyType') ?? '').trim(),
        assessable: parseNumber(at(row, 'assessable')),
        cgst: parseNumber(at(row, 'cgst')),
        sgst: parseNumber(at(row, 'sgst')),
        igst: parseNumber(at(row, 'igst')),
        cess: parseNumber(at(row, 'cess')),
        ewb_no: String(at(row, 'ewbNo') ?? '').trim(),
        ewb_date: formatDate(at(row, 'ewbDate')),
        raw,
      };
      docs.push(doc);
    }
  });

  return { docs, warnings };
};
