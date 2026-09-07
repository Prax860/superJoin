"""Compare new facts with retrieved candidates and classify the relationships.

All pairs from one upload are judged in a single Gemini call. Doing one call per
fact is far more expensive and runs straight into free-tier request limits.
"""
from typing import Dict, List

from app import config
from app.llm import llm
from app.services.fact_service import fact_to_text

VALID = {"CORROBORATES", "CONTRADICTS", "RECONCILES", "UNCERTAIN"}


def build_pairs(candidates_by_fact: List[Dict]) -> List[Dict]:
    """Flatten [{fact, fact_id, candidates}] into numbered pairs worth comparing.

    Weak matches are dropped rather than asked about, which keeps the prompt short
    and the answers meaningful.

    Candidates are taken rank by rank - every fact's best match first, then every
    fact's second match - so the pair budget is spread across the document instead
    of being spent entirely on the first few facts.
    """
    pairs: List[Dict] = []
    depth = max((len(e["candidates"]) for e in candidates_by_fact), default=0)

    for rank in range(depth):
        for entry in candidates_by_fact:
            if rank >= len(entry["candidates"]):
                continue
            candidate = entry["candidates"][rank]
            if candidate.get("similarity", 0) < config.SIMILARITY_THRESHOLD:
                continue
            pairs.append(
                {
                    "pair_id": len(pairs) + 1,
                    "fact_a_id": entry["fact_id"],
                    "fact_b_id": candidate["id"],
                    "new_fact": entry["fact"],
                    "existing_fact": candidate,
                }
            )
            if len(pairs) >= config.MAX_PAIRS:
                return pairs
    return pairs


def _render(pairs: List[Dict]) -> str:
    lines = []
    for pair in pairs:
        new_fact, existing = pair["new_fact"], pair["existing_fact"]
        lines.append(f"PAIR {pair['pair_id']}")
        lines.append(f"  NEW:      {fact_to_text(new_fact)}")
        if new_fact.get("original_text"):
            lines.append(f"  context:  {new_fact['original_text'][:250]}")
        lines.append(f"  EXISTING: {fact_to_text(existing)}")
        if existing.get("original_text"):
            lines.append(f"  context:  {existing['original_text'][:250]}")
        lines.append("")
    return "\n".join(lines)


def compare(pairs: List[Dict]) -> List[Dict]:
    """Return [{fact_a_id, fact_b_id, relationship_type, explanation, confidence}, ...]."""
    if not pairs:
        return []

    try:
        judgements = llm.compare_facts(_render(pairs))
    except Exception as exc:
        # LLM failure: record honest uncertainty rather than guessing a relationship.
        return [
            {
                "fact_a_id": p["fact_a_id"],
                "fact_b_id": p["fact_b_id"],
                "relationship_type": "UNCERTAIN",
                "explanation": f"The comparison model could not be reached ({type(exc).__name__}), "
                               "so this pair was not evaluated.",
                "confidence": 0.0,
            }
            for p in pairs
        ]

    by_id = {p["pair_id"]: p for p in pairs}
    results = []
    seen = set()
    for judgement in judgements:
        pair = by_id.get(judgement.pair_id)
        if not pair or judgement.pair_id in seen:
            continue
        seen.add(judgement.pair_id)
        label = (judgement.relationship or "").strip().upper()
        results.append(
            {
                "fact_a_id": pair["fact_a_id"],
                "fact_b_id": pair["fact_b_id"],
                "relationship_type": label if label in VALID else "UNCERTAIN",
                "explanation": judgement.explanation,
                "confidence": judgement.confidence,
            }
        )
    return results
