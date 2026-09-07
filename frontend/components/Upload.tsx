"use client";

import { useState } from "react";
import { uploadPdf } from "@/lib/api";

export default function Upload({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await uploadPdf(file);
      setMessage(result.message);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button onClick={submit} disabled={!file || busy}>
          {busy ? "Processing..." : "Upload & extract"}
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Extraction, evidence checking and cross-document comparison run synchronously; a large
        PDF can take a minute.
      </p>
      {message && <p className="muted">{message}</p>}
      {error && <p className="error" style={{ marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
