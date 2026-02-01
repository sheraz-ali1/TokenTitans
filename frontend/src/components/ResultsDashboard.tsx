import type { BillData, Discrepancy, ChatResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import BillItemsTable from "./BillItemsTable";

interface ResultsDashboardProps {
  billData: BillData;
  discrepancies: Discrepancy[];
  assessment: ChatResponse["assessment"];
  totalSavings: number;
  onRestart: () => void;
  onNavigateToDispute: () => void;
}

const severityColors = {
  high: {
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  medium: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  low: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
};

const typeLabels: Record<string, string> = {
  duplicate_charge: "Duplicate Charge",
  price_inflation: "Price Inflation",
  quantity_anomaly: "Quantity Anomaly",
  math_error: "Math Error",
};

export default function ResultsDashboard({
  billData,
  discrepancies,
  assessment,
  totalSavings,
  onRestart,
  onNavigateToDispute,
}: ResultsDashboardProps) {
  const highCount = discrepancies.filter((d) => d.severity === "high").length;
  const medCount = discrepancies.filter((d) => d.severity === "medium").length;

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
        <div className="flex items-center justify-between mb-10 animate-[fadeIn_0.5s_ease-out]">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Analysis Report
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-mono">
              {billData.provider_name || "Medical Provider"} &middot;{" "}
              {billData.billing_date || "N/A"}
            </p>
          </div>
          <button
            onClick={onRestart}
            className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-4 py-2 transition-all"
          >
            Analyze Another Bill
          </button>
        </div>

        {/* Savings hero */}
        <div
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 mb-8 animate-[fadeIn_0.6s_ease-out_0.1s_both]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs tracking-wider uppercase font-medium mb-2">
                Potential Savings Identified
              </p>
              <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-teal-500 font-mono tracking-tight">
                $
                {totalSavings.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <div className="flex items-center gap-4 mt-4">
                {highCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {highCount} high severity
                  </span>
                )}
                {medCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {medCount} medium severity
                  </span>
                )}
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-slate-600 text-xs">Total Billed</p>
                <p className="text-white font-mono text-lg">
                  $
                  {(billData.total_billed ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              {billData.patient_responsibility != null && (
                <div>
                  <p className="text-slate-600 text-xs">Patient Owes</p>
                  <p className="text-white font-mono text-lg">
                    $
                    {billData.patient_responsibility.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Discrepancy cards */}
        {discrepancies.length > 0 && (
          <div className="mb-8 animate-[fadeIn_0.7s_ease-out_0.2s_both]">
            <h2 className="text-white text-lg font-semibold mb-4">
              Discrepancies Found
            </h2>
            <div className="space-y-3">
              {discrepancies.map((d, i) => {
                const colors = severityColors[d.severity];
                return (
                  <div
                    key={i}
                    className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${colors.badge} text-[10px] uppercase tracking-wider hover:${colors.badge}`}
                        >
                          {d.severity}
                        </Badge>
                        <span className="text-slate-400 text-xs font-mono">
                          {typeLabels[d.type] || d.type}
                        </span>
                      </div>
                      {d.potential_overcharge > 0 && (
                        <span className={`${colors.text} font-mono text-sm font-medium`}>
                          +$
                          {d.potential_overcharge.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {d.description}
                    </p>
                    {d.reference && (
                      <p className="text-slate-600 text-xs mt-2 font-mono">
                        Reference: ${d.reference.avg_price} avg / $
                        {d.reference.high_price} high
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                        Confidence:
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-slate-500 border-slate-700"
                      >
                        {d.confidence}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assessment from chat */}
        {assessment && (
          <div className="mb-8 rounded-xl border border-teal-500/20 bg-teal-500/5 p-6 animate-[fadeIn_0.8s_ease-out_0.3s_both]">
            <h2 className="text-teal-300 text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Interview Assessment
            </h2>
            {assessment.confirmed_discrepancies?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Confirmed Issues
                </p>
                <ul className="space-y-1">
                  {assessment.confirmed_discrepancies.map((item, i) => (
                    <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">&#x2717;</span>
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assessment.new_concerns?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  New Concerns
                </p>
                <ul className="space-y-1">
                  {assessment.new_concerns.map((item, i) => (
                    <li key={i} className="text-sm text-amber-300 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">!</span>
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assessment.cleared_items?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Cleared Items
                </p>
                <ul className="space-y-1">
                  {assessment.cleared_items.map((item, i) => (
                    <li key={i} className="text-sm text-teal-300 flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5">&#x2713;</span>
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Line items table */}
        <div className="mb-8 animate-[fadeIn_0.9s_ease-out_0.4s_both]">
          <h2 className="text-white text-lg font-semibold mb-4">
            All Line Items
          </h2>
          <BillItemsTable
            items={billData.line_items}
            discrepancies={discrepancies}
          />
        </div>

        {/* Dispute CTA */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center animate-[fadeIn_1s_ease-out_0.5s_both]">
          <p className="text-slate-400 text-sm mb-3">
            Want to dispute these charges?
          </p>
          <button
            onClick={onNavigateToDispute}
            className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl px-8 py-3.5 text-sm font-medium transition-all shadow-lg shadow-teal-900/20"
          >
            Send Dispute Letter
          </button>
          <p className="text-slate-600 text-xs mt-3">
            AI-powered email drafting & lookup
          </p>
        </div>
      </div>
    </div>
  );
}
