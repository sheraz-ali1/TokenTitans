import { useState, useEffect, useRef, useCallback } from "react";
import type { BillData, Discrepancy, ChatResponse } from "@/lib/api";
import { startChat, sendMessage } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  sessionId: string;
  billData: BillData;
  discrepancies: Discrepancy[];
  onComplete: (assessment: ChatResponse["assessment"]) => void;
  onBack: () => void;
}

export default function ChatInterface({
  sessionId,
  billData,
  discrepancies,
  onComplete,
  onBack,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-start conversation
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await startChat(sessionId);
        if (cancelled) return;
        setMessages([{ role: "assistant", content: res.message }]);
        if (res.assessment?.assessment_complete) {
          onComplete(res.assessment);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: "assistant",
              content:
                "I'm having trouble connecting. Please try again.",
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          inputRef.current?.focus();
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [sessionId, onComplete]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const res = await sendMessage(sessionId, text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.message },
      ]);
      if (res.assessment?.assessment_complete) {
        onComplete(res.assessment);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const totalBilled = billData.total_billed ?? 0;
  const flaggedCount = discrepancies.length;

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex flex-col">
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header bar */}
      <div className="relative z-10 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-white text-sm font-semibold">
                Bill Review Interview
              </h2>
              <p className="text-slate-500 text-xs font-mono">
                {billData.provider_name || "Medical Provider"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <p className="text-slate-500">Total Billed</p>
              <p className="text-white font-mono font-medium">
                ${totalBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            {flaggedCount > 0 && (
              <div className="text-right">
                <p className="text-slate-500">Flagged</p>
                <p className="text-red-400 font-mono font-medium">
                  {flaggedCount} item{flaggedCount > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              style={{
                animation: `fadeSlideUp 0.3s ease-out ${i === messages.length - 1 ? "0s" : "0s"} both`,
              }}
            >
              <div
                className={`
                  max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed
                  ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white rounded-br-md"
                      : "bg-slate-800/80 text-slate-200 rounded-bl-md border border-slate-700/50"
                  }
                `}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                      Billing Assistant
                    </span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content.replace(/```json[\s\S]*?```/g, "").trim()}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/80 rounded-2xl rounded-bl-md border border-slate-700/50 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10 border-t border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your response..."
              disabled={isLoading}
              className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl px-4 py-3 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
