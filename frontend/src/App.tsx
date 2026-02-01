import { useState, useCallback } from "react";
import type {
  BillData,
  Discrepancy,
  UploadResponse,
  ChatResponse,
} from "@/lib/api";
import { getResults, confirmBill } from "@/lib/api";
import BillUpload from "@/components/BillUpload";
import BillItemsTable from "@/components/BillItemsTable";
import ChatInterface from "@/components/ChatInterface";
import ResultsDashboard from "@/components/ResultsDashboard";
import DisputePage from "@/components/DisputePage";

type Screen = "upload" | "review" | "chat" | "results" | "dispute";

function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [sessionId, setSessionId] = useState<string>("");
  const [billData, setBillData] = useState<BillData | null>(null);
  const [editableBillData, setEditableBillData] = useState<BillData | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [assessment, setAssessment] = useState<ChatResponse["assessment"]>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleImageReady = useCallback((url: string) => {
    setImageUrl(url);
    setIsTransitioning(true);
    // Small delay to allow exit animation
    setTimeout(() => {
      setScreen("review");
      setIsTransitioning(false);
    }, 150);
  }, []);

  const handleUploadComplete = useCallback((data: UploadResponse & { image_url?: string; discrepancies?: Discrepancy[] }) => {
    try {
      setSessionId(data.session_id);
      setBillData(data.bill_data);
      setEditableBillData(data.bill_data);
      // Discrepancies are empty until user confirms
      setDiscrepancies(data.discrepancies || []);
      // Keep existing imageUrl if already set, otherwise use from response
      if (!imageUrl && data.image_url) {
        setImageUrl(data.image_url);
      }
      setScreen("review");
    } catch (error) {
      console.error("Error handling upload complete:", error);
      setScreen("upload");
    }
  }, [imageUrl]);

  const handleConfirmBill = useCallback(async () => {
    if (!editableBillData) return;
    
    setIsConfirming(true);
    setConfirmError(null);
    
    try {
      const result = await confirmBill(sessionId, editableBillData);
      setBillData(editableBillData);
      setDiscrepancies(result.discrepancies);
      setTotalSavings(result.total_savings);
      setScreen("chat");
    } catch (err) {
      setConfirmError("Failed to analyze bill. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  }, [sessionId, editableBillData]);

  const handleUpdateLineItems = useCallback((items: BillData["line_items"]) => {
    if (!editableBillData) return;
    const newTotal = items.reduce((sum, item) => sum + (item.total_charge || 0), 0);
    setEditableBillData({
      ...editableBillData,
      line_items: items,
      total_billed: newTotal,
    });
  }, [editableBillData]);

  const handleChatComplete = useCallback(
    async (chatAssessment: ChatResponse["assessment"]) => {
      setAssessment(chatAssessment);
      try {
        const results = await getResults(sessionId);
        setTotalSavings(results.total_potential_savings);
      } catch {
        // Fallback: compute from discrepancies
        setTotalSavings(
          discrepancies.reduce(
            (sum, d) => sum + (d.potential_overcharge || 0),
            0
          )
        );
      }
      setScreen("results");
    },
    [sessionId, discrepancies]
  );

  const handleRestart = useCallback(() => {
    // Clean up blob URL if it exists
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setScreen("upload");
    setSessionId("");
    setBillData(null);
    setEditableBillData(null);
    setDiscrepancies([]);
    setAssessment(null);
    setTotalSavings(0);
    setConfirmError(null);
    setImageUrl(null);
  }, [imageUrl]);

  if (screen === "upload" && !isTransitioning) {
    return (
      <div className="screen-enter">
        <BillUpload onUploadComplete={handleUploadComplete} onImageReady={handleImageReady} />
      </div>
    );
  }

  if (screen === "review" || isTransitioning) {
    const savings = billData
      ? discrepancies.reduce((sum, d) => sum + (d.potential_overcharge || 0), 0)
      : 0;

    return (
      <div className="min-h-screen bg-[#0a0f1c] relative screen-enter">
        {/* Grain */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {billData ? "Bill Extracted" : "Analyzing Bill"}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {billData
                  ? `${billData.provider_name || "Medical Provider"} &middot; ${billData.line_items?.length || 0} line items found`
                  : "Extracting line items with AI..."}
              </p>
            </div>
            <button
              onClick={handleRestart}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Start Over
            </button>
          </div>

          {/* Quick stats - only show when billData is available */}
          {billData && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Total Billed
                </p>
                <p className="text-white text-2xl font-mono font-bold">
                  $
                  {(billData.total_billed ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Issues Found
                </p>
                <p
                  className={`text-2xl font-mono font-bold ${
                    discrepancies.length > 0 ? "text-red-400" : "text-teal-400"
                  }`}
                >
                  {discrepancies.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Potential Savings
                </p>
                <p className="text-teal-400 text-2xl font-mono font-bold">
                  $
                  {savings.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Discrepancy alerts - only show when billData is available */}
          {billData && discrepancies.length > 0 && (
            <div className="mb-4 space-y-2">
              {discrepancies.map((d, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm flex items-center justify-between ${
                    d.severity === "high"
                      ? "bg-red-500/10 border border-red-500/20 text-red-300"
                      : d.severity === "medium"
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                      : "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                  }`}
                >
                  <span>{d.description}</span>
                  {d.potential_overcharge && d.potential_overcharge > 0 && (
                    <span className="font-mono font-medium ml-4 shrink-0">
                      +${d.potential_overcharge.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator when extracting */}
          {!billData && (
            <div className="mb-4 flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm">Extracting charges from bill...</p>
              </div>
            </div>
          )}

          {/* Side-by-side: Image and Table */}
          <div className={`grid gap-4 mb-6 ${imageUrl ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Uploaded Image - show immediately */}
            {imageUrl && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden animate-[slideInRight_0.5s_ease-out]">
                <div className="p-3 border-b border-slate-800">
                  <h2 className="text-white text-sm font-semibold">Uploaded Bill</h2>
                </div>
                <div className="p-3">
                  <img
                    src={imageUrl}
                    alt="Uploaded medical bill"
                    className="w-full h-auto rounded-lg border border-slate-800 max-h-[600px] object-contain bg-slate-950"
                  />
                </div>
              </div>
            )}
            
            {/* Line items table - only show when billData is available */}
            {billData && billData.line_items && billData.line_items.length > 0 && (
              <div className={`${!imageUrl ? 'lg:col-span-1' : ''} animate-[slideInRight_0.6s_ease-out_0.2s_both]`}>
                <div className="mb-2">
                  <h2 className="text-white text-sm font-semibold">Extracted Charges</h2>
                </div>
                <BillItemsTable items={billData.line_items} discrepancies={discrepancies} />
              </div>
            )}
            
            {/* Loading placeholder for table area */}
            {!billData && imageUrl && (
              <div className="flex items-center justify-center min-h-[400px] rounded-xl border border-slate-800 bg-slate-900/50">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-teal-400 border-t-transparent animate-spin mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">Extracting charges...</p>
                </div>
              </div>
            )}
          </div>

          {/* Continue to chat */}
          {billData && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => {
                  setChatKey(prev => prev + 1);
                  setScreen("chat");
                }}
                className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl px-8 py-3.5 text-sm font-medium transition-all flex items-center gap-2"
              >
                Continue to Interview
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "chat" && billData) {
    return (
      <ChatInterface
        key={`chat-${sessionId}-${chatKey}`}
        sessionId={sessionId}
        billData={billData}
        discrepancies={discrepancies}
        onComplete={handleChatComplete}
        onBack={() => setScreen("review")}
      />
    );
  }

  if (screen === "results" && billData) {
    return (
      <ResultsDashboard
        billData={billData}
        discrepancies={discrepancies}
        assessment={assessment}
        totalSavings={totalSavings}
        onRestart={handleRestart}
        onNavigateToDispute={() => setScreen("dispute")}
      />
    );
  }

  if (screen === "dispute" && billData) {
    return (
      <DisputePage
        sessionId={sessionId}
        billData={billData}
        discrepancies={discrepancies}
        totalSavings={totalSavings}
        assessment={assessment}
        onBack={() => setScreen("results")}
        onRestart={handleRestart}
      />
    );
  }

  // Fallback: show error state
  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">Error: Invalid screen state</p>
        <button
          onClick={handleRestart}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}

export default App;
