import { useState, useCallback } from "react";
import type {
  BillData,
  Discrepancy,
  UploadResponse,
  ChatResponse,
} from "@/lib/api";
import { getResults, confirmBill } from "@/lib/api";
import BillUpload from "@/components/BillUpload";
import EditableBillTable from "@/components/EditableBillTable";
import ChatInterface from "@/components/ChatInterface";
import ResultsDashboard from "@/components/ResultsDashboard";
import DisputePage from "@/components/DisputePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const handleUploadComplete = useCallback((data: UploadResponse) => {
    setSessionId(data.session_id);
    setBillData(data.bill_data);
    setEditableBillData(data.bill_data);
    // Discrepancies are empty until user confirms
    setDiscrepancies([]);
    setScreen("review");
  }, []);

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
    setScreen("upload");
    setSessionId("");
    setBillData(null);
    setEditableBillData(null);
    setDiscrepancies([]);
    setAssessment(null);
    setTotalSavings(0);
    setConfirmError(null);
  }, []);

  if (screen === "upload") {
    return <BillUpload onUploadComplete={handleUploadComplete} />;
  }

  if (screen === "review" && editableBillData) {
    const calculatedTotal = editableBillData.line_items.reduce(
      (sum, item) => sum + (item.total_charge || 0),
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
                Review Your Bill
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {editableBillData.provider_name || "Medical Provider"} &middot;{" "}
                {editableBillData.line_items.length} line items found
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={handleRestart}
              className="text-slate-500 hover:text-slate-300"
            >
              Start Over
            </Button>
          </div>

          {/* Info Card */}
          <Card className="bg-blue-500/5 border-blue-500/20 mb-6">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-300 text-sm font-medium">Review the extracted data</p>
                  <p className="text-blue-300/70 text-xs mt-0.5">
                    Please verify that the items below match your bill. You can edit any incorrect values before we analyze for discrepancies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-5">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Total Billed
                </p>
                <p className="text-white text-2xl font-mono font-bold">
                  ${calculatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-5">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                  Line Items
                </p>
                <p className="text-white text-2xl font-mono font-bold">
                  {editableBillData.line_items.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Editable Line Items Table */}
          <div className="mb-8">
            <EditableBillTable
              items={editableBillData.line_items}
              onUpdate={handleUpdateLineItems}
            />
          </div>

          {/* Error message */}
          {confirmError && (
            <Card className="bg-red-500/10 border-red-500/20 mb-6">
              <CardContent className="py-3">
                <p className="text-red-400 text-sm">{confirmError}</p>
              </CardContent>
            </Card>
          )}

          {/* Confirm and Continue */}
          <div className="flex justify-center">
            <Button
              onClick={handleConfirmBill}
              disabled={isConfirming || editableBillData.line_items.length === 0}
              className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl px-8 py-6 text-sm font-medium"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  Confirm Bill & Analyze
                  <svg
                    className="w-4 h-4 ml-2"
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
                </>
              )}
            </Button>
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

  return null;
}

export default App;
