import React from 'react';

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
  if (data.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">{caption}</p>
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg border border-gray-200 max-h-[70vh]">
      <table className="w-full text-sm text-left text-gray-700">
        <caption className="p-4 text-lg font-semibold text-left text-gray-900 bg-white">
          {caption}
          <p className="mt-1 text-sm font-normal text-gray-500">{data.length.toLocaleString()} records.</p>
        </caption>
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.isNumeric || c.isMoney ? 'text-right' : ''}`}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="bg-white border-b hover:bg-indigo-50/40">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.isNumeric || c.isMoney ? 'font-mono text-right' : ''}`}>
                  {fmt(row[c.key], c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
