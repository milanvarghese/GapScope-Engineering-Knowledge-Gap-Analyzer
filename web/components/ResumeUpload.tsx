"use client";

import { useRef, useState } from "react";

interface ResumeUploadProps {
  onUpload: (file: File) => void;
  loading?: boolean;
}

export default function ResumeUpload({ onUpload, loading }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File) {
    if (!f) return;
    onUpload(f);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") handleFile(f);
  }

  if (loading) {
    return (
      <div className="border border-[var(--rule-bright)] px-6 py-8 flex flex-col items-center gap-3">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--amber)] animate-pulse">
          reading résumé…
        </span>
        <span className="font-mono text-xs text-[var(--ink-muted)]">
          extracting tools and skills
        </span>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        "border cursor-pointer px-6 py-10 flex flex-col items-center gap-3 transition-colors duration-150",
        dragging
          ? "border-[var(--amber)] bg-[var(--amber-dim)]/10"
          : "border-dashed border-[var(--rule-bright)] hover:border-[var(--amber-dim)] hover:bg-[var(--canvas-3)]",
      ].join(" ")}
    >
      <span className="font-mono text-2xl text-[var(--ink-muted)] select-none">↑</span>
      <span className="font-mono text-sm text-[var(--ink)] tracking-tight">
        Drop résumé PDF or click to browse
      </span>
      <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--ink-muted)]">
        PDF · max 10 MB
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload résumé PDF"
      />
    </div>
  );
}
