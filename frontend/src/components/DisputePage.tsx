import { useState, useEffect } from "react";
import type { BillData, Discrepancy, ChatResponse, DisputePreviewResponse } from "@/lib/api";
import { getDisputePreview, sendDispute } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DisputePageProps {
  sessionId: string;
  billData: BillData;
  discrepancies: Discrepancy[];
  totalSavings: number;
  assessment: ChatResponse["assessment"];
  onBack: () => void;
  onRestart: () => void;
  onSent?: () => void;
}

export default function DisputePage({
  sessionId,
  billData,
  discrepancies,
  totalSavings,
  onBack,
  onRestart,
}: DisputePageProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<DisputePreviewResponse | null>(null);
  const [patientName, setPatientName] = useState(billData.patient_name || "");
  const [originalName, setOriginalName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [letterContent, setLetterContent] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dispute preview on mount
  useEffect(() => {
    async function loadPreview() {
      setError(null);
      try {
        const data = await getDisputePreview(sessionId);
        setPreview(data);
        setRecipientEmail(data.hospital_email || "");
        setLetterContent(data.draft_letter);
        setOriginalName(billData.patient_name || "Patient");
      } catch (err) {
        setError("Failed to generate dispute letter. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadPreview();
  }, [sessionId, billData.patient_name]);

  // Update letter content when patient name changes
  useEffect(() => {
    if (letterContent && originalName && patientName && patientName !== originalName) {
      setLetterContent((prev) => prev.replace(new RegExp(originalName, 'g'), patientName));
      setOriginalName(patientName);
    }
  }, [patientName, originalName, letterContent]);

  const handleSend = async () => {
    if (!recipientEmail || !letterContent) return;
    
    setSending(true);
    setError(null);
    try {
      await sendDispute(sessionId, recipientEmail, letterContent);
      setSuccess(true);
    } catch (err) {
      setError("Failed to send email. Please check the address and try again.");
    } finally {
      setSending(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] relative flex items-center justify-center p-6">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <Card className="relative z-10 max-w-md w-full bg-slate-900/50 border-slate-800 animate-[fadeIn_0.5s_ease-out]">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Dispute Sent!</h2>
            <p className="text-slate-400 text-sm mb-4">
              Your formal dispute letter has been emailed to {recipientEmail}.
            </p>
            <Card className="bg-teal-500/10 border-teal-500/20 mb-6">
              <CardContent className="py-4">
                <p className="text-xs text-teal-300 uppercase tracking-wider mb-1">Potential Savings</p>
                <p className="text-3xl font-bold text-teal-400 font-mono">
                  ${totalSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={onRestart}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl px-6 py-3"
              >
                Analyze Another Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] relative flex items-center justify-center">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 text-center">
          <div className="relative mb-6 mx-auto w-16 h-16">
            <div className="w-16 h-16 border-2 border-teal-500/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Generating Dispute Letter</h3>
          <p className="text-slate-400 text-sm">Preparing your formal dispute letter...</p>
        </div>
      </div>
    );
  }

  // Error state - show retry option
  if (error && !preview) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] relative flex items-center justify-center p-6">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <Card className="relative z-10 max-w-md w-full bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={onBack} className="border-slate-700 text-slate-300">
                Go Back
              </Button>
              <Button onClick={() => window.location.reload()} className="bg-teal-600 hover:bg-teal-500">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-500 hover:text-slate-300 p-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Send Dispute Letter
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {billData.provider_name || "Medical Provider"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={onRestart}
            className="text-slate-500 hover:text-slate-300"
          >
            Start Over
          </Button>
        </div>

        {/* Main Content */}
        {preview && (
          <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-5">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Billed</p>
                  <p className="text-white text-xl font-mono font-bold">
                    ${(billData.total_billed ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-5">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Issues Identified</p>
                  <p className="text-white text-xl font-mono font-bold">{discrepancies.length}</p>
                </CardContent>
              </Card>
              <Card className="border-teal-500/30 bg-teal-500/5">
                <CardContent className="py-5">
                  <p className="text-teal-300 text-xs uppercase tracking-wider mb-1">Potential Savings</p>
                  <p className="text-teal-400 text-xl font-mono font-bold">
                    ${totalSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column: Hospital & Issues */}
              <div className="space-y-6">
                
                {/* Your Info */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Your Name</label>
                      <Input
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                        placeholder="Enter your full name"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        This will appear on the dispute letter.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Hospital Info */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Hospital Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Hospital Name</label>
                      <p className="text-white text-sm">{preview.hospital_name}</p>
                    </div>
                    {preview.hospital_address && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Address</label>
                        <p className="text-slate-300 text-sm">{preview.hospital_address}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                        Billing Email
                      </label>
                      <Input
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                        placeholder="billing@hospital.com"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Enter the hospital's billing department email address.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Issues Summary */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Issues Being Disputed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {preview.issues.map((issue, i) => (
                        <div key={i} className="flex justify-between items-start text-sm border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                          <div>
                            <Badge variant="outline" className="mb-1 text-[10px] border-slate-700 text-slate-400">{issue.type}</Badge>
                            <p className="text-slate-300 text-xs">{issue.description}</p>
                          </div>
                          {issue.potential_overcharge > 0 && (
                            <span className="text-teal-400 font-mono text-xs whitespace-nowrap ml-2">
                              +${issue.potential_overcharge.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right Column: Draft Letter */}
              <div className="space-y-6">
                <Card className="bg-slate-900/50 border-slate-800 h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Draft Letter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <textarea
                      value={letterContent}
                      onChange={(e) => setLetterContent(e.target.value)}
                      className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none"
                      style={{ minHeight: "400px" }}
                    />
                    <p className="text-[10px] text-slate-500 mt-2 text-right">
                      Feel free to edit the text before sending.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {error && (
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="py-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Confirm & Send Bar */}
            <div className="sticky bottom-6 z-20">
              <Card className="border-slate-700 bg-slate-900 shadow-2xl">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">Sending to:</p>
                    <p className="text-sm text-white font-medium truncate">{recipientEmail || "Please enter an email"}</p>
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={!recipientEmail || sending}
                    className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg px-8 py-3 text-sm font-bold shadow-lg shadow-teal-900/20"
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Confirm & Send Email
                        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
