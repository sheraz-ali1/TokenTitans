import { useState, useCallback } from "react";
import type {
  BillData,
  Discrepancy,
  UploadResponse,
  ChatResponse,
} from "@/lib/api";
import { getResults } from "@/lib/api";
import BillUpload from "@/components/BillUpload";
import BillItemsTable from "@/components/BillItemsTable";
import ChatInterface from "@/components/ChatInterface";
import ResultsDashboard from "@/components/ResultsDashboard";

type Screen = "upload" | "review" | "chat" | "results";

function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [sessionId, setSessionId] = useState<string>("");
  const [billData, setBillData] = useState<BillData | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [assessment, setAssessment] = useState<ChatResponse["assessment"]>(null);
  const [totalSavings, setTotalSavings] = useState(0);

  const handleUploadComplete = useCallback((data: UploadResponse) => {
    setSessionId(data.session_id);
    setBillData(data.bill_data);
    setDiscrepancies(data.discrepancies);
    setScreen("review");
  }, []);

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
    setScreen("upload");
    setSessionId("");
    setBillData(null);
    setDiscrepancies([]);
    setAssessment(null);
    setTotalSavings(0);
  }, []);

  if (screen === "upload") {
    return <BillUpload onUploadComplete={handleUploadComplete} />;
  }

  if (screen === "review" && billData) {
    const savings = discrepancies.reduce(
      (sum, d) => sum + (d.potential_overcharge || 0),
      0
    );

    return (
      <div className="min-h-screen bg-[#0a0f1c] relative">
        {/* Grain */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Bill Extracted
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {billData.provider_name || "Medical Provider"} &middot;{" "}
                {billData.line_items.length} line items found
              </p>
            </div>
            <button
              onClick={handleRestart}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Start Over
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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

          {/* Discrepancy alerts */}
          {discrepancies.length > 0 && (
            <div className="mb-6 space-y-2">
              {discrepancies.map((d, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
                    d.severity === "high"
                      ? "bg-red-500/10 border border-red-500/20 text-red-300"
                      : d.severity === "medium"
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                      : "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                  }`}
                >
                  <span>{d.description}</span>
                  {d.potential_overcharge > 0 && (
                    <span className="font-mono font-medium ml-4 shrink-0">
                      +${d.potential_overcharge.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Line items */}
          <div className="mb-8">
            <BillItemsTable items={billData.line_items} discrepancies={discrepancies} />
          </div>

          {/* Continue to chat */}
          <div className="flex justify-center">
            <button
              onClick={() => setScreen("chat")}
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
        </div>
      </div>
    );
  }

  if (screen === "chat" && billData) {
    return (
      <ChatInterface
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
      />
    );
  }

  return null;
}

export default App;
