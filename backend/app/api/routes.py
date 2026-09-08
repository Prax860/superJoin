"""FastAPI routes: upload a PDF, then browse documents, facts and relationships."""
from typing import Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app import config
from app.db import get_client
from app.services import comparison_service, fact_service, pdf_service, retrieval_service

router = APIRouter()

# Everything except the embedding, which is large and not useful to the UI.
FACT_COLUMNS = (
    "id,document_id,subject,predicate,value,normalized_value,normalized_unit,unit,"
    "value_type,time_period,geography,scope,qualifiers,original_text,confidence,verified,created_at"
)


def _db():
    try:
        return get_client()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backend is not configured: {exc}") from exc


def _attach(facts: List[Dict], documents: Dict[int, str], evidence: Dict[int, List[Dict]]) -> List[Dict]:
    for fact in facts:
        fact["document_filename"] = documents.get(fact["document_id"], "unknown")
        fact["evidence"] = evidence.get(fact["id"], [])
    return facts


def _load_facts(client, fact_ids: Optional[List[int]] = None, document_id: Optional[int] = None,
                limit: int = 200) -> List[Dict]:
    query = client.table("facts").select(FACT_COLUMNS)
    if fact_ids is not None:
        if not fact_ids:
            return []
        query = query.in_("id", fact_ids)
    if document_id is not None:
        query = query.eq("document_id", document_id)
    facts = query.order("id", desc=True).limit(limit).execute().data or []
    if not facts:
        return []

    ids = [f["id"] for f in facts]
    evidence_rows = client.table("evidence").select("*").in_("fact_id", ids).execute().data or []
    evidence: Dict[int, List[Dict]] = {}
    for row in evidence_rows:
        evidence.setdefault(row["fact_id"], []).append(row)

    doc_ids = list({f["document_id"] for f in facts})
    doc_rows = client.table("documents").select("id,filename").in_("id", doc_ids).execute().data or []
    documents = {d["id"]: d["filename"] for d in doc_rows}
    return _attach(facts, documents, evidence)


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a .pdf file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # 1. text extraction (page numbers preserved)
    try:
        pages = pdf_service.extract_pages(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    client = _db()

    try:
        document = (
            client.table("documents")
            .insert({"filename": file.filename, "status": "processing", "page_count": len(pages)})
            .execute()
            .data[0]
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save the document: {exc}") from exc
    document_id = document["id"]

    try:
        # 2. fact extraction + evidence verification
        extracted, extraction_errors = fact_service.extract_document_facts(file.filename, pages)
        if not extracted:
            client.table("documents").update({"status": "no_facts"}).eq("id", document_id).execute()
            return {"document": document, "facts": [], "relationships": [],
                    "message": "No facts could be extracted from this PDF."}

        # 3. embeddings
        embeddings = retrieval_service.embed_facts(extracted)

        # 4. store facts + evidence
        rows = []
        for fact, embedding in zip(extracted, embeddings):
            row = {k: v for k, v in fact.items() if not k.startswith("_")}
            row["document_id"] = document_id
            row["embedding"] = embedding
            rows.append(row)
        inserted = client.table("facts").insert(rows).execute().data or []

        evidence_rows = [
            {**fact["_evidence"], "fact_id": stored["id"]}
            for fact, stored in zip(extracted, inserted)
        ]
        if evidence_rows:
            client.table("evidence").insert(evidence_rows).execute()

        # 5. retrieval: pgvector lookup per fact (cheap, no LLM involved)
        candidates_by_fact = []
        for fact, stored, embedding in list(zip(extracted, inserted, embeddings))[: config.MAX_COMPARED_FACTS]:
            if not fact.get("verified"):
                continue  # ungrounded facts are not used for cross-document claims
            candidates = retrieval_service.find_similar(embedding, document_id)
            if candidates:
                candidates_by_fact.append(
                    {"fact": fact, "fact_id": stored["id"], "candidates": candidates}
                )

        # 6. comparison (one LLM call for every pair) + 7. store relationships
        pairs = comparison_service.build_pairs(candidates_by_fact)
        relationships = comparison_service.compare(pairs)

        if relationships:
            client.table("relationships").insert(relationships).execute()

        client.table("documents").update({"status": "processed"}).eq("id", document_id).execute()
    except Exception as exc:
        client.table("documents").update({"status": "failed"}).eq("id", document_id).execute()
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc

    message = f"Extracted {len(inserted)} facts and {len(relationships)} relationships."
    if extraction_errors:
        message += (
            f" {len(extraction_errors)} page group(s) could not be processed,"
            " so this document is only partially covered."
        )

    return {
        "document": {**document, "status": "processed"},
        "facts": _load_facts(client, document_id=document_id),
        "relationships": _load_relationships(client, document_id=document_id),
        "message": message,
        "warnings": extraction_errors,
    }


@router.get("/documents")
async def get_documents():
    client = _db()
    return client.table("documents").select("*").order("id", desc=True).execute().data or []


def _count_facts(client, document_id: int) -> int:
    """Exact fact count for one document, without pulling the rows back."""
    try:
        return (
            client.table("facts")
            .select("id", count="exact")
            .eq("document_id", document_id)
            .limit(1)
            .execute()
            .count
            or 0
        )
    except Exception:
        return 0


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    """Remove a document and everything derived from it.

    facts, evidence and relationships are all ON DELETE CASCADE from documents
    (see schema.sql), so a single delete clears the whole subtree.
    """
    client = _db()

    existing = (
        client.table("documents").select("id,filename").eq("id", document_id).execute().data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="No such document.")

    filename = existing[0]["filename"]
    facts_removed = _count_facts(client, document_id)

    try:
        client.table("documents").delete().eq("id", document_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not delete: {exc}") from exc

    return {
        "deleted": document_id,
        "filename": filename,
        "facts_removed": facts_removed,
        "message": f"Removed '{filename}' and {facts_removed} fact(s).",
    }


@router.get("/facts")
async def get_facts(document_id: Optional[int] = Query(None), limit: int = Query(200)):
    return _load_facts(_db(), document_id=document_id, limit=limit)


@router.get("/relationships")
async def get_relationships(document_id: Optional[int] = Query(None), limit: int = Query(100)):
    return _load_relationships(_db(), document_id=document_id, limit=limit)


def _load_relationships(client, document_id: Optional[int] = None, limit: int = 100) -> List[Dict]:
    rows = (
        client.table("relationships")
        .select("*")
        .order("id", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    if not rows:
        return []

    fact_ids = list({r["fact_a_id"] for r in rows} | {r["fact_b_id"] for r in rows})
    facts = {f["id"]: f for f in _load_facts(client, fact_ids=fact_ids, limit=len(fact_ids) or 1)}

    result = []
    for row in rows:
        fact_a, fact_b = facts.get(row["fact_a_id"]), facts.get(row["fact_b_id"])
        if not fact_a or not fact_b:
            continue
        if document_id is not None and document_id not in (fact_a["document_id"], fact_b["document_id"]):
            continue
        result.append({**row, "fact_a": fact_a, "fact_b": fact_b})
    return result
