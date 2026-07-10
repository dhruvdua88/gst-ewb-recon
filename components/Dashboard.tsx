import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { SummaryData, ReconciliationResult } from '../types';
import { periodLabel } from '../services/utils';

const PALETTE = ['#16a34a', '#b45309', '#dc2626', '#2563eb', '#7c3aed', '#0891b2', '#64748b'];

interface Props { summary: SummaryData; report: ReconciliationResult; }

/**
 * Visual dashboard (ECharts): period-wise position, what drives "Only in GSTR-1", and
 * the top buyers behind the gap — so the shape of the reconciliation is legible at a
 * glance before drilling into the grids.
 */
export const Dashboard: React.FC<Props> = ({ summary, report }) => {
  const periods = summary.perPeriod.map((p) => periodLabel(p.period));

  const periodOpt = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: periods },
    yAxis: { type: 'value' },
    series: [
      { name: 'Matched', type: 'bar', stack: 't', color: PALETTE[0], data: summary.perPeriod.map((p) => p.matched) },
      { name: 'Variance', type: 'bar', stack: 't', color: PALETTE[1], data: summary.perPeriod.map((p) => p.variances) },
      { name: 'GSTR only', type: 'bar', stack: 't', color: PALETTE[2], data: summary.perPeriod.map((p) => p.gstrOnly) },
      { name: 'EWB only', type: 'bar', stack: 't', color: PALETTE[3], data: summary.perPeriod.map((p) => p.ewbOnly) },
    ],
  };

  // What drives "Only in GSTR-1" — group by reason.
  const reasonAgg = new Map<string, number>();
  report.gstr_only.forEach((r) => {
    const short = String(r.reason).split('—')[0].split('(')[0].trim().slice(0, 40);
    reasonAgg.set(short, (reasonAgg.get(short) || 0) + 1);
  });
  const reasonData = [...reasonAgg.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const reasonOpt = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    color: PALETTE,
    series: [{ type: 'pie', radius: ['38%', '66%'], center: ['50%', '44%'], data: reasonData,
      label: { fontSize: 10 }, minAngle: 4 }],
  };

  // Top buyers by value involved (variance value-at-risk + GSTR-only assessable).
  const buyerAgg = new Map<string, number>();
  const addB = (g: string, v: number) => { if (g && g !== 'N/A') buyerAgg.set(g, (buyerAgg.get(g) || 0) + Math.abs(v)); };
  report.variances.forEach((r) => addB(r.buyer_gstin, r.abs_value_at_risk));
  report.gstr_only.filter((r) => !r.reason.includes('Below EWB threshold')).forEach((r) => addB(r.buyer_gstin, r.assessable));
  const topB = [...buyerAgg.entries()].map(([g, v]) => ({ g, v })).sort((a, b) => b.v - a.v).slice(0, 8).reverse();
  const buyerOpt = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) => '₹' + (v || 0).toLocaleString('en-IN') },
    grid: { left: 130, right: 24, top: 10, bottom: 24 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: topB.map((b) => b.g), axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', color: PALETTE[2], data: topB.map((b) => Math.round(b.v)) }],
  };

  const Panel = ({ title, opt }: { title: string; opt: any }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-1">{title}</h4>
      <ReactECharts option={opt} style={{ height: 260 }} notMerge lazyUpdate />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
      {periods.length > 0 && <Panel title="Period-wise position (document counts)" opt={periodOpt} />}
      {reasonData.length > 0 && <Panel title="What drives “Only in GSTR-1”" opt={reasonOpt} />}
      {topB.length > 0 && <Panel title="Top buyers by value involved" opt={buyerOpt} />}
    </div>
  );
};
