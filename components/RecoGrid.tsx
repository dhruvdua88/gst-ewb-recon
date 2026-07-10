import React, { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import type { Column } from './DataTable';

// v33+ requires explicit module registration or the grid renders blank.
ModuleRegistry.registerModules([AllCommunityModule]);

const inrFmt = (p: any) =>
  typeof p.value === 'number'
    ? p.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (p.value ?? '');
const numFmt = (p: any) => (typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : (p.value ?? ''));

interface Props {
  data: any[];
  columns: Column[];
  caption: string;
}

/**
 * Batteries-included results grid (AG Grid Community): column sort, per-column
 * floating filters, quick-search, pagination, and CSV export — replaces the hand-rolled
 * table so 100k+ rows stay smooth and every column filters/sorts without bespoke code.
 */
export const RecoGrid: React.FC<Props> = ({ data, columns, caption }) => {
  const gridRef = useRef<AgGridReact>(null);

  const colDefs = useMemo<ColDef[]>(() =>
    columns.map((c) => {
      const numeric = !!(c.isNumeric || c.isMoney);
      return {
        field: c.key,
        headerName: c.title,
        type: numeric ? 'numericColumn' : undefined,
        filter: numeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
        valueFormatter: c.isMoney ? inrFmt : numeric ? numFmt : undefined,
        cellStyle: c.isMoney
          ? (p: any) => (typeof p.value === 'number' && p.value < 0 ? { color: '#b91c1c' } : null)
          : undefined,
        minWidth: numeric ? 120 : 130,
        flex: numeric ? 0 : 1,
      };
    }), [columns]);

  const onFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    gridRef.current?.api.setGridOption('quickFilterText', e.target.value);
  }, []);

  const onExport = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({ fileName: caption.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '.csv' });
  }, [caption]);

  if (!data.length) {
    return <div className="p-6 text-center bg-gray-50 rounded-lg"><p className="text-gray-500">{caption}</p></div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{caption}</h3>
          <p className="text-xs text-gray-500">{data.length.toLocaleString()} records · click a header to sort · use the filter row</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" onChange={onFilter} placeholder="Quick search…"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full sm:w-56" />
          <button onClick={onExport} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap">CSV</button>
        </div>
      </div>
      <div style={{ height: '62vh', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme={themeQuartz}
          rowData={data}
          columnDefs={colDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true, floatingFilter: true, minWidth: 110 }}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200]}
          enableCellTextSelection
          onGridReady={(e: GridReadyEvent) => e.api.sizeColumnsToFit()}
        />
      </div>
    </div>
  );
};
