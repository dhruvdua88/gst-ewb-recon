import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';
import { guessPeriodFromName } from '../services/utils';

interface FileUploaderProps {
  title: string;
  acceptedTypes: string;
  icon: React.ReactNode;
  files: File[];                          // merged list (source of truth, owned by parent)
  onAdd: (files: File[]) => void;         // append newly-picked files (already snapshotted)
  onRemove: (index: number) => void;      // drop one file
  onClear: () => void;                    // drop all
  periodLabels?: string[];                // optional per-file period (overrides filename guess)
}

export function FileUploader({
  title, acceptedTypes, icon, files, onAdd, onRemove, onClear, periodLabels,
}: FileUploaderProps): React.ReactNode {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    // Snapshot into an array immediately — the live FileList is emptied the moment the
    // input is reset / drop ends, but the async setState updater reads it later.
    if (e.dataTransfer.files?.length) onAdd(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="flex flex-col">
      <label
        className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-400'}`}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
        onDrop={onDrop}
      >
        <div className="mb-2">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <input
          type="file" className="hidden" accept={acceptedTypes} multiple ref={inputRef}
          onChange={(e) => {
            // Copy the FileList to an array BEFORE clearing the input — clearing the
            // input value empties the live FileList, and the parent's async setState
            // reads it after that, which previously dropped every picked file.
            const picked = e.target.files ? Array.from(e.target.files) : [];
            if (inputRef.current) inputRef.current.value = '';
            if (picked.length) onAdd(picked);
          }}
        />
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-semibold text-indigo-600">{files.length ? 'Add more files' : 'Click to upload'}</span> or drag &amp; drop
          <p className="text-xs text-gray-400">{acceptedTypes.replace(/,/g, ' or ')} · select several at once, or drop each month one at a time</p>
        </div>
      </label>

      {files.length > 0 && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">{files.length} file{files.length > 1 ? 's' : ''} loaded</span>
            <button type="button" onClick={onClear} className="text-xs text-red-600 hover:underline">Clear all</button>
          </div>
          <ul className="divide-y divide-gray-100 max-h-44 overflow-y-auto">
            {files.map((f, i) => {
              const p = periodLabels?.[i] || guessPeriodFromName(f.name);
              return (
                <li key={`${f.name}:${f.size}:${i}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <UploadIcon />
                  <span className="flex-1 truncate text-gray-700" title={f.name}>{f.name}</span>
                  {p && <span className="shrink-0 text-indigo-600 font-medium bg-indigo-50 rounded px-1.5 py-0.5">{p}</span>}
                  <button type="button" onClick={() => onRemove(i)} className="shrink-0 text-gray-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>✕</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
