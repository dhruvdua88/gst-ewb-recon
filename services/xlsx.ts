// Single bundled entry point for the SheetJS fork (xlsx-js-style). Previously this was
// a runtime CDN <script> exposing a global `XLSX`; bundling it makes reconciliation and
// Excel export work fully offline / on networks that block jsdelivr.
//
// xlsx-js-style ships as CJS, so Vite's interop can put the real API on `.default`.
// Normalise both shapes here so callers just `import XLSX from './xlsx'`.
import * as XLSXns from 'xlsx-js-style';

const resolved: any = (XLSXns as any)?.utils ? XLSXns : (XLSXns as any)?.default;
const XLSX: any = resolved ?? XLSXns;

export default XLSX;
