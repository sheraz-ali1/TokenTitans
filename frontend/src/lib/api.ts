const API_BASE = "http://localhost:8000";

export interface LineItem {
  code: string | null;
  description: string;
  quantity: number;
  unit_charge: number;
  total_charge: number;
  date_of_service: string | null;
  category: string;
}

export interface BillData {
  patient_name: string | null;
  provider_name: string | null;
  billing_date: string | null;
  account_number: string | null;
  total_billed: number | null;
  insurance_adjustments: number | null;
  patient_responsibility: number | null;
  line_items: LineItem[];
}

export interface Discrepancy {
  type: string;
  severity: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  description: string;
  items_involved: number[];
  potential_overcharge: number;
  reference?: {
    description: string;
    avg_price: number;
    high_price: number;
  };
}

export interface UploadResponse {
  session_id: string;
  bill_data: BillData;
  discrepancies: Discrepancy[];
}

export interface ChatResponse {
  message: string;
  assessment: {
    assessment_complete: boolean;
    confirmed_discrepancies: string[];
    new_concerns: string[];
    cleared_items: string[];
  } | null;
}

export interface ResultsResponse {
  bill_data: BillData;
  discrepancies: Discrepancy[];
  assessment: ChatResponse["assessment"];
  total_potential_savings: number;
  chat_history: { role: string; content: string }[];
}

export interface DisputePreviewResponse {
  hospital_name: string;
  hospital_address: string;
  hospital_email: string;
  draft_letter: string;
  issues: { type: string; description: string; potential_overcharge: number }[];
  total_savings: number;
}

export async function uploadBill(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload-bill`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function startChat(sessionId: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Chat start failed: ${res.statusText}`);
  return res.json();
}

export async function sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}

export async function getResults(sessionId: string): Promise<ResultsResponse> {
  const res = await fetch(`${API_BASE}/results/${sessionId}`);
  if (!res.ok) throw new Error(`Results failed: ${res.statusText}`);
  return res.json();
}

export async function getDisputePreview(sessionId: string): Promise<DisputePreviewResponse> {
  const res = await fetch(`${API_BASE}/dispute/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Dispute preview failed: ${res.statusText}`);
  return res.json();
}

export async function sendDispute(sessionId: string, recipientEmail: string, letter: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/dispute/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, recipient_email: recipientEmail, letter }),
  });
  if (!res.ok) throw new Error(`Dispute send failed: ${res.statusText}`);
  return res.json();
}
