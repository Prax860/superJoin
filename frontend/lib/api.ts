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

export type RelationshipType = "CORROBORATES" | "CONTRADICTS" | "RECONCILES" | "UNCERTAIN";

export type Relationship = {
  id: number;
  relationship_type: RelationshipType;
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

/**
 * Reads time out after 10s. Without this, an unreachable API leaves the UI in
 * its loading state for over a minute: on Windows `localhost` resolves to ::1
 * first, and the connection hangs until the TCP timeout rather than being
 * refused, so the failure never surfaces to the user.
 */
const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`The API did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`Could not reach the API at ${API_URL}`);
  }

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

/**
 * Removes a document and everything derived from it. The cascade lives in the
 * database (facts, evidence and relationships are ON DELETE CASCADE), so one
 * call clears the whole subtree.
 */
export async function deleteDocument(id: number) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/documents/${id}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error(`Could not reach the API at ${API_URL}`);
  }
  if (!response.ok) {
    throw new Error((await errorMessage(response)) || `Delete failed: ${response.status}`);
  }
  return response.json() as Promise<{
    message: string;
    filename: string;
    facts_removed: number;
  }>;
}

export type UploadResult = { message: string; warnings?: string[] };

/**
 * Uploads via XHR rather than fetch so the UI can show true byte-level upload
 * progress. Once the bytes are sent the server still has to extract, verify and
 * compare, which is why callers switch to an indeterminate state at 100%.
 */
export function uploadPdf(
  file: File,
  onProgress?: (fractionSent: number) => void,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/documents/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((body as UploadResult) ?? { message: "Upload complete" });
        return;
      }

      const detail = (body as { detail?: unknown } | null)?.detail;
      reject(
        new Error(
          typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `Upload failed: ${xhr.status}`,
        ),
      );
    };

    // Generous: extraction, evidence checks and comparison all run server-side
    // before the response comes back, so a large PDF legitimately takes minutes.
    xhr.timeout = 10 * 60 * 1000;
    xhr.ontimeout = () => reject(new Error("The server did not finish processing in time"));
    xhr.onerror = () => reject(new Error(`Could not reach the API at ${API_URL}`));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(form);
  });
}
