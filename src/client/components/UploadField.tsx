import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { MAX_PDF_BYTES } from "../../shared/types";
import { formatBytes } from "../lib/format";
import { DocumentIcon, UploadIcon } from "./icons";

interface UploadFieldProps {
  file: File | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  /** Parent-owned error message for this field. */
  error?: string | undefined;
  onErrorChange: (message: string | null) => void;
}

function validatePdf(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are accepted.";
  if (file.size > MAX_PDF_BYTES) return `File is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_PDF_BYTES)}.`;
  return null;
}

export function UploadField({ file, disabled, onSelect, error, onErrorChange }: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (candidate: File | undefined): void => {
    if (!candidate) return;
    const problem = validatePdf(candidate);
    if (problem) {
      onErrorChange(problem);
      return;
    }
    onErrorChange(null);
    onSelect(candidate);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    accept(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700">Resume</span>

      {file === null ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload resume PDF"
          aria-disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
            dragOver
              ? "border-indigo-400 bg-indigo-50/70"
              : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
          }`}
        >
          <UploadIcon className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">
            Drop the resume PDF here, or <span className="text-indigo-600 underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-slate-400">PDF only, up to {formatBytes(MAX_PDF_BYTES)}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <DocumentIcon className="h-5 w-5 shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onErrorChange(null);
              onSelect(null);
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      )}

      {error !== undefined && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
