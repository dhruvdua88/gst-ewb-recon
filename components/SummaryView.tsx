import React from 'react';
import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from '../services/utils';
import { DownloadIcon, CheckCircleIcon, MailIcon } from './Icons';

interface Props {
  summary: SummaryData;
  report: ReconciliationResult;
  onDownloadExcel: () => void;
  onDownloadHtml: () => void;
}

const inr = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => (n || 0).toLocaleString('en-IN');

const Card = ({ label, value, tone }: { label: string; value: string; tone?: 'risk' | 'ok' }) => (
  <div className="flex-1 min-w-[160px] bg-gray-50 border border-gray-200 rounded-xl p-4">
    <div className={`text-2xl font-bold font-mono ${tone === 'risk' ? 'text-red-700' : tone === 'ok' ? 'text-green-700' : 'text-indigo-700'}`}>{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

export function SummaryView({ summary, report, onDownloadExcel, onDownloadHtml }: Props): React.ReactNode {
  const kpis = [
    { label: 'Valid EWB rows (after exclusions)', value: summary.validEwbRows },
    { label: 'Unique EWB documents', value: summary.uniqueEwbDocs },
    { label: 'Unique GSTR-1 documents', value: summary.uniqueGstrDocs },
    { label: 'Documents in both', value: summary.docsInBoth, header: true },
    { label: 'Completely matched', value: summary.completelyMatched, sub: true },
    { label: 'Matched with variance', value: summary.withVariance, sub: true },
    { label: 'Only in E-Way Bill', value: summary.onlyInEwb, header: true },
    { label: 'Only in GSTR-1', value: summary.onlyInGstr },
    { label: 'Timing differences', value: summary.timingDifferenceCount, header: true },
    { label: 'Tax-type (inter/intra) mismatches', value: summary.taxTypeMismatchCount },
    { label: 'GSTIN mismatches', value: summary.gstinMismatchCount },
    { label: 'Cancelled EWB (excluded)', value: summary.cancelledEwbRows, header: true },
    { label: 'Delivery challans (excluded)', value: summary.deliveryChallanRows },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 pb-4 border-b border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <CheckCircleIcon />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Reconciliation Summary</h2>
            <p className="text-sm text-gray-500">Periods: {summary.periods.map(periodLabel).join(', ') || '—'}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={onDownloadHtml} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700">
            <MailIcon /> Emailable Summary
          </button>
          <button onClick={onDownloadExcel} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700">
            <DownloadIcon /> Download Full Report
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Card label="Tax at risk (variances)" value={inr(summary.totalTaxAtRisk)} tone="risk" />
        <Card label="EWB-only tax exposure" value={inr(summary.ewbOnlyTaxExposure)} tone="risk" />
        <Card label="GSTR value likely needing EWB" value={inr(summary.gstrOnlyMissingEwbValue)} />
        <Card label="Matched clean" value={num(summary.completelyMatched)} tone="ok" />
      </div>

      {report.warnings.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Data-quality notes</p>
          <ul className="list-disc list-inside space-y-0.5">
            {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {summary.perPeriod.length > 1 && (
        <div className="mb-6 overflow-x-auto">
          <h3 className="font-semibold text-gray-700 mb-2">Period-wise position</h3>
          <table className="w-full text-sm text-left border border-gray-200 rounded-lg">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2 text-right">GSTR</th>
                <th className="px-3 py-2 text-right">EWB</th>
                <th className="px-3 py-2 text-right">Matched</th>
                <th className="px-3 py-2 text-right">Variances</th>
                <th className="px-3 py-2 text-right">GSTR only</th>
                <th className="px-3 py-2 text-right">EWB only</th>
                <th className="px-3 py-2 text-right">Tax at risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.perPeriod.map((p) => (
                <tr key={p.period} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{periodLabel(p.period)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.gstrDocs)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.ewbDocs)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.matched)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.variances)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.gstrOnly)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(p.ewbOnly)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{inr(p.taxAtRisk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Metric</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider text-right">Count</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {kpis.map((k, i) => (
              <tr key={i} className={`hover:bg-gray-50 ${k.header && i > 0 ? 'border-t-2 border-gray-300' : ''}`}>
                <td className={`px-6 py-3 whitespace-nowrap text-gray-800 ${k.sub ? 'pl-10' : ''} ${k.header ? 'font-semibold' : ''}`}>{k.label}</td>
                <td className="px-6 py-3 whitespace-nowrap text-gray-900 font-mono font-bold text-right">{num(k.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
