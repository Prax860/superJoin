"use client";

import { useState } from "react";
import type { Fact } from "@/lib/api";

export function FactSummary({ fact }: { fact: Fact }) {
  const context = [fact.time_period, fact.geography, fact.scope, fact.qualifiers]
    .filter(Boolean)
    .join(" · ");
  const evidence = fact.evidence[0];

  return (
    <>
      <div style={{ fontWeight: 600 }}>
        {fact.subject} — {fact.predicate}
      </div>
      <div className="mono" style={{ margin: "4px 0" }}>
        {fact.value} {fact.unit && fact.unit !== fact.value ? fact.unit : ""}
      </div>
      {context && <div className="muted">{context}</div>}
      <div className="muted">
        {fact.document_filename}
        {evidence?.page_number ? ` — page ${evidence.page_number}` : ""}
        {fact.confidence != null ? ` — confidence ${fact.confidence.toFixed(2)}` : ""}
      </div>
    </>
  );
}

export default function FactCard({ fact }: { fact: Fact }) {
  const [open, setOpen] = useState(false);
  const evidence = fact.evidence[0];

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className={`tag tag-${fact.verified ? "verified" : "unverified"}`}>
          {fact.verified ? "EVIDENCE VERIFIED" : "UNVERIFIED"}
        </span>
        {evidence && (
          <button className="link" onClick={() => setOpen(!open)}>
            {open ? "Hide evidence" : "Show evidence"}
          </button>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <FactSummary fact={fact} />
      </div>
      {open && evidence && (
        <div className="evidence">
          “{evidence.evidence_text}”
          <div className="muted" style={{ marginTop: 4 }}>
            {fact.document_filename}, page {evidence.page_number}
            {!evidence.verified && " — quote could not be located in the PDF text"}
          </div>
        </div>
      )}
    </div>
  );
}
