export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Evidence = {
  id: number;
  page_number: number | null;
  evidence_text: string;
  verified: boolean;
};

export type Fact = {
  id: number;
  document_id: number;
  document_filename: string;
  subject: string | null;
  predicate: string | null;
  value: string | null;
  normalized_value: number | null;
  normalized_unit: string | null;
  unit: string | null;
  time_period: string | null;
  geography: string | null;
  scope: string | null;
  qualifiers: string | null;
  original_text: string | null;
  confidence: number | null;
  verified: boolean;
  evidence: Evidence[];
};

export type Relationship = {
  id: number;
  relationship_type: "CORROBORATES" | "CONTRADICTS" | "RECONCILES" | "UNCERTAIN";
  explanation: string | null;
  confidence: number | null;
  fact_a: Fact;
  fact_b: Fact;
};

export type Doc = {
  id: number;
  filename: string;
  uploaded_at: string;
  status: string;
  page_count: number | null;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error((await errorMessage(response)) || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  } catch {
    return "";
  }
}

export const getDocuments = () => request<Doc[]>("/documents");
export const getFacts = () => request<Fact[]>("/facts");
export const getRelationships = () => request<Relationship[]>("/relationships");

export async function uploadPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/documents/upload`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error((await errorMessage(response)) || `Upload failed: ${response.status}`);
  }
  return response.json() as Promise<{ message: string }>;
}
