import React, { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SettingsPanel } from './components/SettingsPanel';
import { reconcile } from './services/reconcile';
import { exportExcel } from './services/excelService';
import { generateHtmlReport } from './services/reportService';
import type { SummaryData, ReconciliationResult, ReconConfig } from './types';
import { DEFAULT_CONFIG } from './types';
import { LogoIcon, DocumentIcon } from './components/Icons';
import { periodFromFp, periodLabel } from './services/utils';

// Merge newly-picked files into the existing list (dedupe by name+size) so periods
// can be added across several clicks / folders instead of each pick replacing the last.
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const mergeFiles = (existing: File[], picked: FileList | null): File[] => {
  if (!picked) return existing;
  // Dedupe on name+size+lastModified — GST-portal exports for different months often
  // share the SAME filename (e.g. returns_..._0.json), so name alone would drop one.
  const byKey = new Map(existing.map((x) => [fileKey(x), x]));
  Array.from(picked).forEach((f) => byKey.set(fileKey(f), f));
  return [...byKey.values()];
};

interface ResultState {
  summary: SummaryData;
  reportData: ReconciliationResult;
}

export default function App(): React.ReactNode {
  const [gstrFiles, setGstrFiles] = useState<File[]>([]);
  const [ewbFiles, setEwbFiles] = useState<File[]>([]);
  const [config, setConfig] = useState<ReconConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  // Detected return period per GSTR file (read from the JSON `fp`) — the portal names
  // every month's export identically, so the filename can't tell them apart.
  const [gstrPeriods, setGstrPeriods] = useState<string[]>([]);

  const reset = () => { setResult(null); setError(null); };

  useEffect(() => {
    let cancelled = false;
    Promise.all(gstrFiles.map(async (f) => {
      try { const fp = JSON.parse(await f.text())?.fp; const p = periodFromFp(fp); return p ? periodLabel(p) : ''; }
      catch { return ''; }
    })).then((labels) => { if (!cancelled) setGstrPeriods(labels); });
    return () => { cancelled = true; };
  }, [gstrFiles]);

  const handleReconcile = useCallback(async () => {
    if (gstrFiles.length === 0 || ewbFiles.length === 0) {
      setError('Upload at least one GSTR-1 JSON and one E-Way Bill Excel file.');
      return;
    }
    setIsLoading(true); setError(null); setResult(null);
    try {
      const gstrTexts = await Promise.all(gstrFiles.map((f) => f.text()));
      const gstrJsons = gstrTexts.map((t, i) => {
        try { return JSON.parse(t); }
        catch { throw new Error(`GSTR-1 file "${gstrFiles[i].name}" is not valid JSON.`); }
      });
      const ewbBuffers = await Promise.all(ewbFiles.map((f) => f.arrayBuffer()));
      const { summary, reportData } = reconcile(gstrJsons, ewbBuffers, config);
      setResult({ summary, reportData });
    } catch (e) {
      console.error(e);
      setError(`Processing failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [gstrFiles, ewbFiles, config]);

  const handleExcel = () => {
    if (!result) return;
    try { exportExcel(result.summary, result.reportData); }
    catch (e) { setError(`Excel export failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  };

  const handleHtml = () => {
    if (!result) return;
    try {
      const html = generateHtmlReport(result.summary, result.reportData);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'EWB_GSTR1_Summary.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { setError('Failed to generate HTML report.'); }
  };

  const canRun = gstrFiles.length > 0 && ewbFiles.length > 0 && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <LogoIcon />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">E-Way Bill vs GSTR-1 Reconciliation</h1>
          </div>
          <p className="text-lg text-gray-600">Multi-period. Timing, tax-type & threshold aware. Actionable, money-led report.</p>
        </header>

        <main>
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
              <FileUploader title="GSTR-1 Offline JSON(s)" acceptedTypes=".json"
                icon={<DocumentIcon className="h-10 w-10 text-blue-500" />}
                files={gstrFiles} periodLabels={gstrPeriods}
                onAdd={(f) => { setGstrFiles((prev) => mergeFiles(prev, f)); reset(); }}
                onRemove={(i) => { setGstrFiles((prev) => prev.filter((_, x) => x !== i)); reset(); }}
                onClear={() => { setGstrFiles([]); reset(); }} />
              <FileUploader title="E-Way Bill Excel Report(s)" acceptedTypes=".xlsx, .xls"
                icon={<DocumentIcon className="h-10 w-10 text-green-500" />}
                files={ewbFiles}
                onAdd={(f) => { setEwbFiles((prev) => mergeFiles(prev, f)); reset(); }}
                onRemove={(i) => { setEwbFiles((prev) => prev.filter((_, x) => x !== i)); reset(); }}
                onClear={() => { setEwbFiles([]); reset(); }} />
            </div>

            <p className="text-xs text-gray-400 text-center mb-2">
              Tip: upload several months of GSTR-1 and E-Way Bill files together — the tool reconciles the whole span and flags timing differences across periods.
            </p>

            <SettingsPanel config={config} onChange={(c) => { setConfig(c); reset(); }} />

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                <p className="font-bold">Error</p><p>{error}</p>
              </div>
            )}

            <div className="flex justify-center mt-6">
              <button onClick={handleReconcile} disabled={!canRun}
                className="w-full md:w-1/2 flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : 'Reconcile'}
              </button>
            </div>
          </div>

          {result && !isLoading && !error && (
            <div className="mt-8">
              <ResultsDisplay summary={result.summary} reportData={result.reportData}
                onDownloadExcel={handleExcel} onDownloadHtml={handleHtml} />
            </div>
          )}
        </main>

        <footer className="text-center text-xs text-gray-400 mt-10">
          Runs entirely in your browser — no file ever leaves your machine.
        </footer>
      </div>
    </div>
  );
}
