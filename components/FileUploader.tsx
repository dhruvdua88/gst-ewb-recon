import React, { useState, useRef } from 'react';
import { UploadIcon } from './Icons';

interface FileUploaderProps {
  title: string;
  acceptedTypes: string;
  onFileSelect: (files: FileList | null) => void;
  icon: React.ReactNode;
}

export function FileUploader({ title, acceptedTypes, onFileSelect, icon }: FileUploaderProps): React.ReactNode {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (files: FileList | null) => {
    setFileNames(files ? Array.from(files).map((f) => f.name) : []);
    onFileSelect(files);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length && inputRef.current) { inputRef.current.files = files; update(files); }
  };

  const display = fileNames.length === 0 ? null
    : fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files selected`;

  return (
    <div className={`p-4 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}`}>
      <label
        className="cursor-pointer flex flex-col items-center justify-center h-full"
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
        onDrop={onDrop}
      >
        <div className="mb-2">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <input type="file" className="hidden" accept={acceptedTypes} multiple ref={inputRef}
          onChange={(e) => update(e.target.files)} />
        {!display ? (
          <div className="mt-2 text-sm text-gray-500">
            <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
            <p>{acceptedTypes.replace(/,/g, ' or ')}</p>
          </div>
        ) : (
          <div className="mt-2 text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center justify-center gap-2">
            <UploadIcon /><span className="truncate">{display}</span>
          </div>
        )}
      </label>
    </div>
  );
}
