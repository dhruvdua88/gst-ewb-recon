// Shared parsing / normalisation helpers.

export const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    // strip currency symbols, commas, spaces; keep sign and decimal
    const cleaned = val.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Normalise any date-ish input to dd/mm/yyyy. Handles JS Date, Excel serial,
 * and common string forms (dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd).
 */
export const formatDate = (input: any): string => {
  if (input === null || input === undefined || input === '') return '';

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return String(input);
    return `${pad2(input.getDate())}/${pad2(input.getMonth() + 1)}/${input.getFullYear()}`;
  }

  if (typeof input === 'number' && input > 1) {
    // Excel serial date (1900 system, with the well-known leap-year offset).
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + input * 86400000);
    if (isNaN(d.getTime())) return String(input);
    return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  const s = String(input).trim();
  // yyyy-mm-dd or yyyy/mm/dd
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${pad2(+m[3])}/${pad2(+m[2])}/${m[1]}`;
  // dd-mm-yyyy or dd/mm/yyyy (GSTR-1 uses dd-mm-yyyy)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${pad2(+m[1])}/${pad2(+m[2])}/${yr}`;
  }
  return s;
};

/** Return YYYY-MM period from a dd/mm/yyyy string, or '' if not parseable. */
export const periodFromDate = (ddmmyyyy: string): string => {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}`;
};

/** Convert GSTR-1 fp (MMYYYY) to YYYY-MM. */
export const periodFromFp = (fp: string | undefined): string => {
  if (!fp) return '';
  const s = String(fp).trim();
  const m = s.match(/^(\d{2})(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  return '';
};

/** Human label for YYYY-MM e.g. "Mar 2026". */
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const periodLabel = (p: string): string => {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m) return p || '—';
  return `${MONTHS[+m[2]] || m[2]} ${m[1]}`;
};

/**
 * Normalise a document number into a comparable token while AVOIDING the
 * over-aggressive collapse of the original tool (which reduced everything to a
 * bare integer and merged unrelated numbers). We:
 *   - uppercase
 *   - drop separators ( space / - _ . )
 *   - strip leading zeros inside each maximal digit run (INV007 -> INV7)
 * so "INV/0007" and "INV7" match, but "INV7" and "PO7" stay distinct.
 */
export const normalizeDocNo = (raw: any): string => {
  if (raw === null || raw === undefined) return 'BLANK';
  let s = String(raw).toUpperCase().trim();
  if (!s) return 'BLANK';
  s = s.replace(/[\s\/\-_.,]/g, '');
  s = s.replace(/\d+/g, (run) => {
    const stripped = run.replace(/^0+/, '');
    return stripped === '' ? '0' : stripped;
  });
  return s || 'BLANK';
};

/**
 * Aggregation key for a document number — uppercased and whitespace-collapsed but
 * WITHOUT stripping separators. This keeps genuinely distinct documents apart
 * (e.g. "90003639" vs "90003639-", which the EWB portal emits as two different
 * consignments) so their values are never summed into one bucket. Fuzzy matching
 * across format differences is still handled separately by normalizeDocNo().
 */
export const rawDocKey = (raw: any): string => {
  if (raw === null || raw === undefined) return 'BLANK';
  const s = String(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  return s || 'BLANK';
};

/** Digits-only fallback token (last-resort match). */
export const digitsOnly = (raw: any): string => {
  const d = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d || '';
};

/**
 * Best-effort guess of the return period from a file name, for a pre-run UX hint only.
 * Recognises "Apr 2026", "April26", "04-2026", "042026", "2026-04". Returns a label
 * like "Apr 2026" or '' if nothing recognisable. NOT used for reconciliation logic.
 */
const MON_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
export const guessPeriodFromName = (name: string): string => {
  const s = String(name || '').toLowerCase();
  // month-name + year: "apr 2026" / "april-26" / "apr26"
  const mn = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[^0-9]?(\d{2,4})/);
  if (mn) {
    const mo = MON_NAMES[mn[1]];
    const yr = mn[2].length === 2 ? 2000 + +mn[2] : +mn[2];
    if (mo && yr >= 2017 && yr <= 2099) return periodLabel(`${yr}-${String(mo).padStart(2, '0')}`);
  }
  // yyyy-mm
  let m = s.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])(?!\d)/);
  if (m) return periodLabel(`${m[1]}-${m[2]}`);
  // mm-yyyy or mmyyyy
  m = s.match(/(?<!\d)(0[1-9]|1[0-2])[-_ ]?(20\d{2})/);
  if (m) return periodLabel(`${m[2]}-${m[1]}`);
  return '';
};

export const normalizeGstin = (raw: any): string =>
  String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const uniq = (arr: string[]): string[] => Array.from(new Set(arr.filter(Boolean)));
