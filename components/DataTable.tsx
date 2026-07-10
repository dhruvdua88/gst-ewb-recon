import React, { useMemo, useState } from 'react';

export interface Column {
  key: string;
  title: string;
  isNumeric?: boolean;
  isMoney?: boolean;     // format with 2 decimals + colour negatives
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  caption: string;
}

const PAGE_SIZE = 50;

const fmt = (v: any, col: Column): React.ReactNode => {
  if (v === null || v === undefined || v === '') return '–';
  if ((col.isMoney || col.isNumeric) && typeof v === 'number') {
    const txt = col.isMoney
      ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toLocaleString('en-IN');
    const cls = col.isMoney && v < 0 ? 'text-red-600' : col.isMoney && v > 0 ? 'text-gray-900' : '';
    return <span className={cls}>{txt}</span>;
  }
  return String(v);
};

export const DataTable: React.FC<DataTableProps> = ({ data, columns, caption }) => {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // Free-text filter across all columns.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(q)));
  }, [data, columns, query]);

  // Sort (numeric-aware).
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const numeric = !!(col && (col.isMoney || col.isNumeric));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (numeric) return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const onSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  if (data.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">{caption}</p>
      </div>
    );
  }

  const from = sorted.length ? clampedPage * PAGE_SIZE + 1 : 0;
  const to = Math.min(sorted.length, (clampedPage + 1) * PAGE_SIZE);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{caption}</h3>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <input
            type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search doc no, GSTIN, reason…"
            className="w-full sm:w-72 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {query ? `${sorted.length.toLocaleString()} of ${data.length.toLocaleString()} match` : `${data.length.toLocaleString()} records`}
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto max-h-[62vh]">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
            <tr>
              {columns.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    className={`px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200 ${c.isNumeric || c.isMoney ? 'text-right' : ''} ${active ? 'text-indigo-700' : ''}`}
                    title="Click to sort"
                  >
                    {c.title}
                    <span className="ml-1 text-gray-400">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="bg-white border-b hover:bg-indigo-50/40">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.isNumeric || c.isMoney ? 'font-mono text-right' : ''}`}>
                    {fmt(row[c.key], c)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">No rows match “{query}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between p-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">Rows {from.toLocaleString()}–{to.toLocaleString()} of {sorted.length.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-gray-600">Page {clampedPage + 1} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};
