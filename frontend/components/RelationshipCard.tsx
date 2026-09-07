"use client";

import type { Relationship } from "@/lib/api";
import { FactSummary } from "./FactCard";

function Pane({ label, fact }: { label: string; fact: Relationship["fact_a"] }) {
  const evidence = fact.evidence[0];
  return (
    <div className="pane">
      <div className="muted" style={{ marginBottom: 6 }}>{label}</div>
      <FactSummary fact={fact} />
      {evidence && <div className="evidence">“{evidence.evidence_text}”</div>}
    </div>
  );
}

export default function RelationshipCard({ relationship }: { relationship: Relationship }) {
  return (
    <div className="card">
      <div className="row">
        <span className={`tag tag-${relationship.relationship_type}`}>
          {relationship.relationship_type}
        </span>
        {relationship.confidence != null && (
          <span className="muted">confidence {relationship.confidence.toFixed(2)}</span>
        )}
      </div>
      <div className="pair">
        <Pane label="Fact A" fact={relationship.fact_a} />
        <Pane label="Fact B" fact={relationship.fact_b} />
      </div>
      <div className="why">
        <strong>Why?</strong> {relationship.explanation}
      </div>
    </div>
  );
}
