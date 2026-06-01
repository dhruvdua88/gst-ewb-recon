import type { Gstr1File, Gstr1Invoice, ParsedGstrDoc, DocCategory } from '../types';
import { parseNumber, formatDate, periodFromDate, periodFromFp } from './utils';

interface RawSection {
  section: string;
  category: DocCategory;
  ctin?: string;
  invoices: Gstr1Invoice[];
  isNote: boolean; // CDNR
}

const collectSections = (f: Gstr1File): RawSection[] => {
  const out: RawSection[] = [];

  (f.b2b || []).forEach((s) =>
    out.push({ section: 'b2b', category: 'INV', ctin: s.ctin, invoices: s.inv || [], isNote: false })
  );
  (f.b2ba || []).forEach((s) =>
    out.push({ section: 'b2ba', category: 'B2BA', ctin: s.ctin, invoices: s.inv || [], isNote: false })
  );
  (f.sez || []).forEach((s) =>
    out.push({ section: 'sez', category: 'SEZ', ctin: s.ctin, invoices: s.inv || [], isNote: false })
  );
  (f.exp || []).forEach((s) =>
    out.push({ section: 'exp', category: 'EXP', ctin: 'EXPORT', invoices: s.inv || [], isNote: false })
  );
  (f.cdnr || []).forEach((s) =>
    out.push({ section: 'cdnr', category: 'CDNR_C', ctin: s.ctin, invoices: s.nt || s.inv || [], isNote: true })
  );

  return out;
};

const itemTotals = (inv: Gstr1Invoice) => {
  let assessable = 0, cgst = 0, sgst = 0, igst = 0, cess = 0, isService = false;
  (inv.itms || []).forEach((it) => {
    const d = it.itm_det;
    if (!d) return;
    assessable += parseNumber(d.txval);
    cgst += parseNumber(d.camt);
    sgst += parseNumber(d.samt);
    igst += parseNumber(d.iamt);
    cess += parseNumber(d.csamt);
    const hsn = String(d.hsn_sc ?? '');
    // SAC (services) HSN codes start with 99. EWB not required for pure services.
    if (hsn.startsWith('99')) isService = true;
  });
  return { assessable, cgst, sgst, igst, cess, isService };
};

export const parseGstrFiles = (files: Gstr1File[]): { docs: ParsedGstrDoc[]; warnings: string[] } => {
  const docs: ParsedGstrDoc[] = [];
  const warnings: string[] = [];

  files.forEach((f, idx) => {
    if (!f || typeof f !== 'object') {
      warnings.push(`GSTR-1 file #${idx + 1} is not valid JSON object — skipped.`);
      return;
    }
    const filePeriod = periodFromFp(f.fp);

    collectSections(f).forEach((sec) => {
      sec.invoices.forEach((inv) => {
        const isNote = sec.isNote;
        const docNo = (isNote ? inv.nt_num : inv.inum) ?? inv.inum ?? '';
        const rawDate = (isNote ? inv.nt_dt : inv.idt) ?? inv.idt ?? '';
        const docDate = formatDate(rawDate);
        const period = filePeriod || periodFromDate(docDate);
        const t = itemTotals(inv);

        // Credit note reduces outward liability -> negative sign. Debit note positive.
        let category = sec.category;
        let sign: 1 | -1 = 1;
        if (isNote) {
          if (inv.ntty === 'C') { category = 'CDNR_C'; sign = -1; }
          else if (inv.ntty === 'D') { category = 'CDNR_D'; sign = 1; }
        }

        docs.push({
          source_section: sec.section,
          category,
          doc_no: String(docNo),
          doc_date: docDate,
          period,
          fp: f.fp || '',
          buyer_gstin: sec.ctin || 'N/A',
          place_of_supply: String(inv.pos ?? ''),
          rchrg: (inv.rchrg as 'Y' | 'N') || 'N',
          invoice_value: parseNumber(inv.val) * sign,
          assessable: t.assessable * sign,
          cgst: t.cgst * sign,
          sgst: t.sgst * sign,
          igst: t.igst * sign,
          cess: t.cess * sign,
          is_service: t.isService,
          sign,
        });
      });
    });

    if (collectSections(f).every((s) => s.invoices.length === 0)) {
      warnings.push(`GSTR-1 file #${idx + 1}${f.fp ? ` (fp ${f.fp})` : ''} had no B2B/EXP/SEZ/CDNR invoices.`);
    }
  });

  return { docs, warnings };
};
