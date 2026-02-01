import { useState, useCallback, useRef } from "react";
import type { UploadResponse } from "@/lib/api";
import { uploadBill } from "@/lib/api";

interface BillUploadProps {
  onUploadComplete: (data: UploadResponse) => void;
}

export default function BillUpload({ onUploadComplete }: BillUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);
      setIsUploading(true);

      try {
        const data = await uploadBill(file);
        if (!data || !data.bill_data) {
          throw new Error("Invalid response from server");
        }
        onUploadComplete(data);
      } catch (err) {
        console.error("Upload error:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
        setIsUploading(false);
        setFileName(null);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full bg-blue-500/8 blur-[100px]" />

      {/* Header */}
      <div className="relative z-10 text-center mb-12 animate-[fadeIn_0.6s_ease-out]">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight text-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            MedBill Analyzer
          </h1>
        </div>
        <p className="text-slate-400 text-sm tracking-wide max-w-md">
          Upload your medical bill and our AI will extract charges, detect
          discrepancies, and help you save money.
        </p>
      </div>

      {/* Upload zone */}
      <div
        className={`
          relative z-10 w-full max-w-lg
          animate-[fadeIn_0.8s_ease-out_0.2s_both]
        `}
      >
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-2xl border-2 border-dashed
            transition-all duration-300 ease-out
            ${
              isDragging
                ? "border-teal-400 bg-teal-400/5 scale-[1.02]"
                : "border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-900/70"
            }
            ${isUploading ? "pointer-events-none" : ""}
          `}
        >
          <div className="p-12 text-center">
            {isUploading ? (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                <div>
                  <p className="text-white text-sm font-medium">
                    Analyzing {fileName}
                  </p>
                  <p className="text-slate-500 text-xs mt-1 font-mono">
                    Extracting line items with Gemini...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`
                    mx-auto w-16 h-16 rounded-2xl mb-5 flex items-center justify-center
                    transition-colors duration-300
                    ${isDragging ? "bg-teal-400/20" : "bg-slate-800"}
                  `}
                >
                  <svg
                    className={`w-7 h-7 transition-colors duration-300 ${
                      isDragging ? "text-teal-400" : "text-slate-500"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="text-white text-sm font-medium mb-1">
                  Drop your medical bill here
                </p>
                <p className="text-slate-500 text-xs">
                  or click to browse &middot; PDF, PNG, JPG accepted
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-xs font-mono">{error}</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="relative z-10 mt-12 flex items-center gap-6 text-xs text-slate-600 animate-[fadeIn_1s_ease-out_0.4s_both]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          Powered by Gemini
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          HIPAA-aware design
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          No data stored
        </span>
      </div>
    </div>
  );
}
