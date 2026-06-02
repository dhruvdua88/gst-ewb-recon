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

// Strip everything except a-z0-9 so "Doc.No", "Doc No" and "DOCNO" all collapse
// to "docno". GST portal headers use dots (Doc.No / Doc.Date / Doc.Type) which
// the old space-based synonyms missed.
const squash = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const buildColMap = (headers: string[]): ColMap => {
  const squashed = headers.map(squash);
  const map: ColMap = {};
  for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
    let idx = -1;
    for (const syn of syns) {
      const s = squash(syn);
      idx = squashed.findIndex((h) => h.includes(s));
      if (idx !== -1) break;
    }
    map[field] = idx;
  }
  return map;
};

/** Decode an ArrayBuffer to text (UTF-8). */
const bufToText = (buf: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(buf));
  } catch {
    // Fallback for environments without TextDecoder.
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

/**
 * The GST portal exports the E-Way Bill report as an HTML <table> saved with a
 * .xls extension — it is NOT a real Excel binary. SheetJS does not parse it
 * (every line lands in a single cell), so we extract the table ourselves.
 * Uses DOMParser in the browser; falls back to a regex scan elsewhere.
 */
const htmlToGrid = (text: string): any[][] | null => {
  if (!/<\s*tr[\s>]/i.test(text) && !/<\s*table[\s>]/i.test(text)) return null;

  // Browser path: DOMParser handles malformed markup robustly.
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const table = doc.querySelector('table');
      const trs = Array.from((table || doc).querySelectorAll('tr'));
      const grid = trs.map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((c) =>
          (c.textContent || '').replace(/\s+/g, ' ').trim()
        )
      );
      if (grid.length) return grid;
    } catch {
      /* fall through to regex */
    }
  }

  // Regex fallback (non-DOM environments).
  const grid = [...text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    )
  );
  return grid.length ? grid : null;
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
    let grid: any[][] | null = null;

    // GST portal "xls" files are really HTML tables — try that first.
    const text = bufToText(buf);
    if (/^\s*</.test(text) || /<\s*table[\s>]/i.test(text)) {
      grid = htmlToGrid(text);
    }

    // Real .xlsx / .xls (binary) — let SheetJS handle it.
    if (!grid) {
      let workbook: any;
      try {
        workbook = XLSX.read(buf, { type: 'array', cellDates: true });
      } catch {
        warnings.push(`E-Way Bill file #${fileIdx + 1} could not be read as Excel or HTML — skipped.`);
        return;
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    }

    if (!grid || grid.length < 2) {
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

      // GST HTML exports wrap some fields in single quotes ('172418734122') and
      // use a leading Excel text-marker ('90000356) — strip both ends.
      const stripQuote = (v: any) => String(v ?? '').trim().replace(/^'+|'+$/g, '');

      const docNo = stripQuote(at(row, 'docNo'));
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
        ewb_no: stripQuote(at(row, 'ewbNo')),
        ewb_date: formatDate(at(row, 'ewbDate')),
        raw,
      };
      docs.push(doc);
    }
  });

  return { docs, warnings };
};
