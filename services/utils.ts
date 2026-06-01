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

/** Digits-only fallback token (last-resort match). */
export const digitsOnly = (raw: any): string => {
  const d = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d || '';
};

export const normalizeGstin = (raw: any): string =>
  String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const uniq = (arr: string[]): string[] => Array.from(new Set(arr.filter(Boolean)));
