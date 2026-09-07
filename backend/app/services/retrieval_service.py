"""pgvector retrieval: find existing facts related to a new fact."""
from typing import Dict, List

from app import config
from app.db import get_client
from app.llm import llm
from app.services.fact_service import fact_to_text


def embed_facts(facts: List[Dict]) -> List[List[float]]:
    return llm.embed([fact_to_text(f) for f in facts])


def find_similar(embedding: List[float], exclude_document_id: int) -> List[Dict]:
    """Top-K semantically similar facts from *other* documents."""
    response = get_client().rpc(
        "match_facts",
        {
            "query_embedding": embedding,
            "exclude_document_id": exclude_document_id,
            "match_count": config.TOP_K_SIMILAR,
        },
    ).execute()
    return response.data or []
