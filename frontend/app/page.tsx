"use client";

import { useCallback, useEffect, useState } from "react";
import Upload from "@/components/Upload";
import FactCard from "@/components/FactCard";
import RelationshipCard from "@/components/RelationshipCard";
import { getDocuments, getFacts, getRelationships, type Doc, type Fact, type Relationship } from "@/lib/api";

export default function Home() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [docs, factList, relationshipList] = await Promise.all([
        getDocuments(),
        getFacts(),
        getRelationships(),
      ]);
      setDocuments(docs);
      setFacts(factList);
      setRelationships(relationshipList);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main>
      <h1>Fact Knowledge Layer</h1>
      <p className="sub">
        Upload a PDF. Facts are extracted with page-level evidence, then compared against facts
        already stored from other documents.
      </p>

      {error && <p className="error">{error}</p>}

      <Upload onDone={refresh} />

      <h2>Documents ({documents.length})</h2>
      {documents.length === 0 && <p className="muted">No documents yet.</p>}
      {documents.map((doc) => (
        <div className="card" key={doc.id}>
          <div style={{ fontWeight: 600 }}>{doc.filename}</div>
          <div className="muted">
            {doc.status} · {doc.page_count ?? "?"} pages ·{" "}
            {new Date(doc.uploaded_at).toLocaleString()}
          </div>
        </div>
      ))}

      <h2>Relationships ({relationships.length})</h2>
      {relationships.length === 0 && (
        <p className="muted">Upload a second related document to see cross-document relationships.</p>
      )}
      {relationships.map((relationship) => (
        <RelationshipCard key={relationship.id} relationship={relationship} />
      ))}

      <h2>Facts ({facts.length})</h2>
      {facts.length === 0 && <p className="muted">No facts yet.</p>}
      {facts.map((fact) => (
        <FactCard key={fact.id} fact={fact} />
      ))}
    </main>
  );
}
