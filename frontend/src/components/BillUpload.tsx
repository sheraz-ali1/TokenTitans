import { useState, useCallback, useRef } from "react";
import type { UploadResponse } from "@/lib/api";
import { uploadBill } from "@/lib/api";

const API_BASE = "http://localhost:8000";

interface BillUploadProps {
  onUploadComplete: (data: UploadResponse) => void;
  onImageReady?: (imageUrl: string) => void;
}

export default function BillUpload({ onUploadComplete, onImageReady }: BillUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);
      
      // Create a blob URL immediately for image files and notify parent
      const isImage = file.type.startsWith('image/');
      const imageUrl = isImage ? URL.createObjectURL(file) : undefined;
      
      if (imageUrl && onImageReady) {
        onImageReady(imageUrl);
      }
      
      setIsUploading(true);

      try {
        const data = await uploadBill(file);
        if (!data || !data.bill_data) {
          throw new Error("Invalid response from server");
        }
        
        // Add the image URL to the response
        onUploadComplete({ ...data, image_url: imageUrl });
      } catch (err) {
        console.error("Upload error:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
        setIsUploading(false);
        setFileName(null);
        // Clean up blob URL on error
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }
      }
    },
    [onUploadComplete, onImageReady]
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

  const handleTestImage = useCallback(async () => {
    setError(null);
    setIsUploading(true);
    
    try {
      // Fetch random test image from backend
      const response = await fetch(`${API_BASE}/test-image`);
      if (!response.ok) {
        throw new Error("Failed to fetch test image");
      }
      
      const blob = await response.blob();
      const fileName = response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "test-bill.png";
      const file = new File([blob], fileName, { type: blob.type });
      
      // Create blob URL immediately for image files
      const isImage = file.type.startsWith('image/');
      const imageUrl = isImage ? URL.createObjectURL(file) : undefined;
      
      if (imageUrl && onImageReady) {
        onImageReady(imageUrl);
      }
      
      setFileName(file.name);
      
      // Upload the file
      const data = await uploadBill(file);
      if (!data || !data.bill_data) {
        throw new Error("Invalid response from server");
      }
      
      // Add the image URL to the response
      onUploadComplete({ ...data, image_url: imageUrl });
    } catch (err) {
      console.error("Test image error:", err);
      setError(err instanceof Error ? err.message : "Failed to load test image");
      setIsUploading(false);
      setFileName(null);
    }
  }, [onUploadComplete, onImageReady]);

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

      {/* Test with sample image button */}
      <div className="relative z-10 mt-6 text-center">
        <button
          onClick={handleTestImage}
          disabled={isUploading}
          className={`
            px-6 py-2.5 rounded-xl text-sm font-medium transition-all
            ${isUploading
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700 hover:border-slate-600"
            }
          `}
        >
          {isUploading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
              Loading test image...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.57.393A9.065 9.065 0 0121 18.5a9.065 9.065 0 01-6.23-.693L14.25 3.104M5 14.5l-1.57.393A9.065 9.065 0 003 18.5a9.065 9.065 0 006.23-.693L5 14.5" />
              </svg>
              Test with Sample Image
            </span>
          )}
        </button>
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
