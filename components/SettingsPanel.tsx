import React from 'react';
import type { ReconConfig } from '../types';
import { CogIcon } from './Icons';

interface Props {
  config: ReconConfig;
  onChange: (cfg: ReconConfig) => void;
}

const NumField = ({ label, value, onChange, help }: { label: string; value: number; onChange: (n: number) => void; help: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <input
      type="number"
      value={value}
      min={0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
    />
    <span className="text-xs text-gray-400">{help}</span>
  </label>
);

export const SettingsPanel: React.FC<Props> = ({ config, onChange }) => {
  const set = (patch: Partial<ReconConfig>) => onChange({ ...config, ...patch });
  return (
    <details className="mt-4 border border-gray-200 rounded-lg bg-gray-50">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 font-semibold text-gray-700">
        <CogIcon /> Reconciliation settings
      </summary>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField label="Assessable tolerance (₹)" value={config.assessableTolerance}
          onChange={(n) => set({ assessableTolerance: n })} help="Ignore assessable diffs ≤ this." />
        <NumField label="Tax tolerance per head (₹)" value={config.taxTolerance}
          onChange={(n) => set({ taxTolerance: n })} help="Ignore CGST/SGST/IGST diffs ≤ this." />
        <NumField label="EWB threshold (₹)" value={config.ewbThreshold}
          onChange={(n) => set({ ewbThreshold: n })} help="GSTR docs ≤ this need no EWB." />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={config.matchAcrossPeriods}
            onChange={(e) => set({ matchAcrossPeriods: e.target.checked })}
            className="h-4 w-4 text-indigo-600" />
          Match across periods (detect timing diffs)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={config.useGstinInKey}
            onChange={(e) => set({ useGstinInKey: e.target.checked })}
            className="h-4 w-4 text-indigo-600" />
          Use buyer GSTIN in match key
        </label>
      </div>
    </details>
  );
};
