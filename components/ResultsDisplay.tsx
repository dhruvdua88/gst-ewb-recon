import React, { useState, useMemo } from 'react';
import { SummaryView } from './SummaryView';
import { DataTable, type Column } from './DataTable';
import { RecoGrid } from './RecoGrid';
import type { ReconciliationResult, SummaryData } from '../types';

interface Props {
  summary: SummaryData;
  reportData: ReconciliationResult;
  onDownloadExcel: () => void;
  onDownloadHtml: () => void;
}

type TabKey = 'summary' | 'action' | 'matched' | 'variances' | 'ewbOnly' | 'gstrOnly' | 'cancelled' | 'dc';

export const ResultsDisplay: React.FC<Props> = ({ summary, reportData, onDownloadExcel, onDownloadHtml }) => {
  const [tab, setTab] = useState<TabKey>('summary');

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'summary', label: 'Summary', count: -1 },
    { key: 'action', label: '★ Action Register', count: reportData.action_register.length },
    { key: 'variances', label: 'Variances', count: reportData.variances.length },
    { key: 'ewbOnly', label: 'EWB Only', count: reportData.ewb_only.length },
    { key: 'gstrOnly', label: 'GSTR-1 Only', count: reportData.gstr_only.length },
    { key: 'matched', label: 'Matched', count: reportData.completely_matched.length },
    { key: 'cancelled', label: 'Cancelled EWB', count: reportData.cancelled_ewb.length },
    { key: 'dc', label: 'Delivery Challans', count: reportData.delivery_challans.length },
  ];

  const cols = useMemo(() => {
    const action: Column[] = [
      { key: 'priority', title: 'Priority' }, { key: 'type', title: 'Action needed' },
      { key: 'doc_no', title: 'Doc No' }, { key: 'party', title: 'Party / Period' },
      { key: 'amount', title: 'Amount at stake', isMoney: true },
      { key: 'action', title: 'What to do' }, { key: 'detail', title: 'Context' },
    ];
    const matched: Column[] = [
      { key: 'doc_no', title: 'Doc No' }, { key: 'ewb_doc_no', title: 'EWB Doc No' },
      { key: 'doc_date', title: 'Date' }, { key: 'ewb_no', title: 'EWB No(s)' },
      { key: 'buyer_gstin', title: 'Buyer' }, { key: 'category', title: 'Type' },
      { key: 'match_confidence', title: 'Match' }, { key: 'gstr_periods', title: 'GSTR Period' },
      { key: 'invoice_value', title: 'Inv Value', isMoney: true },
      { key: 'assessable_gstr', title: 'Assessable', isMoney: true },
      { key: 'cgst_gstr', title: 'CGST', isMoney: true },
      { key: 'sgst_gstr', title: 'SGST', isMoney: true },
      { key: 'igst_gstr', title: 'IGST', isMoney: true },
    ];
    const variances: Column[] = [
      { key: 'doc_no', title: 'Doc No' }, { key: 'buyer_gstin', title: 'Buyer' },
      { key: 'remarks', title: 'Nature of variance' }, { key: 'match_confidence', title: 'Match' },
      { key: 'gstr_periods', title: 'GSTR Period' }, { key: 'ewb_periods', title: 'EWB Period' },
      { key: 'abs_value_at_risk', title: 'Value at risk', isMoney: true },
      { key: 'assessable_var', title: 'Assessable Δ', isMoney: true },
      { key: 'cgst_var', title: 'CGST Δ', isMoney: true },
      { key: 'sgst_var', title: 'SGST Δ', isMoney: true },
      { key: 'igst_var', title: 'IGST Δ', isMoney: true },
      { key: 'assessable_gstr', title: 'Assess GSTR', isMoney: true },
      { key: 'assessable_ewb', title: 'Assess EWB', isMoney: true },
    ];
    const ewbOnly: Column[] = [
      { key: 'doc_no', title: 'Doc No' }, { key: 'doc_type', title: 'Doc Type' },
      { key: 'other_party_gstin', title: 'Other Party' }, { key: 'reason', title: 'Reason' },
      { key: 'ewb_no', title: 'EWB No(s)' }, { key: 'doc_dates', title: 'Doc Date(s)' },
      { key: 'assessable', title: 'Assessable', isMoney: true },
      { key: 'cgst', title: 'CGST', isMoney: true },
      { key: 'sgst', title: 'SGST', isMoney: true },
      { key: 'igst', title: 'IGST', isMoney: true },
      { key: 'total_tax', title: 'Total Tax', isMoney: true },
    ];
    const gstrOnly: Column[] = [
      { key: 'doc_no', title: 'Doc No' }, { key: 'doc_date', title: 'Date' },
      { key: 'buyer_gstin', title: 'Buyer' }, { key: 'category', title: 'Type' },
      { key: 'reason', title: 'Reason' },
      { key: 'invoice_value', title: 'Inv Value', isMoney: true },
      { key: 'assessable', title: 'Assessable', isMoney: true },
      { key: 'cgst', title: 'CGST', isMoney: true },
      { key: 'sgst', title: 'SGST', isMoney: true },
      { key: 'igst', title: 'IGST', isMoney: true },
    ];
    const raw = (rows: any[]): Column[] =>
      Object.keys(rows[0]?.raw || {}).map((k) => ({ key: k, title: k, isNumeric: /value|amount|cgst|sgst|igst|cess/i.test(k) }));
    return { action, matched, variances, ewbOnly, gstrOnly, cancelled: raw(reportData.cancelled_ewb), dc: raw(reportData.delivery_challans) };
  }, [reportData]);

  // flatten raw for cancelled/dc tables
  const rawRows = (rows: any[]) => rows.map((r) => r.raw);

  const content = () => {
    switch (tab) {
      case 'summary': return <SummaryView summary={summary} report={reportData} onDownloadExcel={onDownloadExcel} onDownloadHtml={onDownloadHtml} />;
      case 'action': return reportData.action_register.length
        ? <RecoGrid data={reportData.action_register} columns={cols.action} caption="The curated to-do list — only items needing human action, highest value first. Timing, free-of-cost and correct exclusions are omitted by design." />
        : <div className="p-8 text-center text-green-700 font-semibold">✓ Nothing needs action — no genuine mismatches after timing, FOC and exclusions are removed.</div>;
      case 'matched': return <RecoGrid data={reportData.completely_matched} columns={cols.matched} caption="Documents in both sources that tie out within tolerance." />;
      case 'variances': return <RecoGrid data={reportData.variances} columns={cols.variances} caption="Matched documents with value, tax-type, GSTIN or timing differences (sorted by value at risk)." />;
      case 'ewbOnly': return <RecoGrid data={reportData.ewb_only} columns={cols.ewbOnly} caption="E-Way Bills with no matching GSTR-1 document — possible under-reporting (sorted by tax)." />;
      case 'gstrOnly': return <RecoGrid data={reportData.gstr_only} columns={cols.gstrOnly} caption="GSTR-1 documents with no matching E-Way Bill (sorted by assessable value)." />;
      case 'cancelled': return <RecoGrid data={rawRows(reportData.cancelled_ewb)} columns={cols.cancelled} caption="E-Way Bills excluded because status is Cancelled." />;
      case 'dc': return <RecoGrid data={rawRows(reportData.delivery_challans)} columns={cols.dc} caption="E-Way Bills excluded because document type is Delivery Challan." />;
      default: return null;
    }
  };

  return (
    <div className="bg-white p-2 sm:p-4 rounded-2xl shadow-lg border border-gray-200 animate-fade-in">
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-x-2 sm:gap-x-4" aria-label="Tabs">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`${tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} group inline-flex items-center py-3 px-1 sm:px-2 border-b-2 font-medium text-sm transition-colors`}>
              {t.label}
              {t.count > 0 && (
                <span className={`${tab === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'} hidden ml-2 py-0.5 px-2 rounded-full text-xs font-medium md:inline-block`}>
                  {t.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">{content()}</div>
    </div>
  );
};
