"""Fact extraction, evidence verification and value normalization."""
import logging
import re
from typing import Dict, List, Optional, Tuple

from app import config
from app.llm import llm
from app.services import pdf_service

log = logging.getLogger(__name__)

# Multipliers that appear in Indian and international reporting.
MAGNITUDES = {
    "thousand": 1e3,
    "k": 1e3,
    "lakh": 1e5,
    "lac": 1e5,
    "million": 1e6,
    "mn": 1e6,
    "mm": 1e6,
    "crore": 1e7,
    "cr": 1e7,
    "billion": 1e9,
    "bn": 1e9,
    "b": 1e9,
    "trillion": 1e12,
    "tn": 1e12,
}

CURRENCIES = {
    "$": "USD", "usd": "USD", "us$": "USD",
    "₹": "INR", "inr": "INR", "rs": "INR", "rs.": "INR", "rupee": "INR", "rupees": "INR",
    "€": "EUR", "eur": "EUR",
}


def _normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


# --------------------------------------------------------------------------
# Normalization
# --------------------------------------------------------------------------
def normalize_value(value: str, unit: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
    """Convert '$5 billion' / 'Rs 5,000 million' into (5000000000.0, 'USD').

    Returns (None, None) when the value is not numeric. The original string is
    always kept separately in facts.value.
    """
    blob = f"{value or ''} {unit or ''}".lower()

    match = re.search(r"-?\d[\d,]*\.?\d*", blob)
    if not match:
        return None, None
    try:
        number = float(match.group(0).replace(",", ""))
    except ValueError:
        return None, None

    for word, factor in MAGNITUDES.items():
        # word boundary so 'b' does not match inside 'bps'
        if re.search(rf"(?<![a-z]){re.escape(word)}(?![a-z])", blob):
            number *= factor
            break

    if "%" in blob or "percent" in blob or "per cent" in blob:
        return number, "percent"

    for token, code in CURRENCIES.items():
        if token in blob:
            return number, code

    return number, (unit or None)


# --------------------------------------------------------------------------
# Evidence verification - never trust the model's quote or page number
# --------------------------------------------------------------------------
def verify_evidence(
    evidence_text: str, claimed_page: int, page_map: Dict[int, str]
) -> Tuple[bool, Optional[int]]:
    """Check the quote really exists in the PDF text.

    Returns (verified, actual_page). If the quote is found on a different page,
    the real page number is used instead of the one the model reported.
    """
    # Models sometimes copy our "[PAGE n]" chunk marker into the quote. That
    # marker is ours, not the document's, so strip it before matching.
    evidence_text = re.sub(r"\[PAGE\s*\d+\]", " ", evidence_text or "", flags=re.I)
    quote = _normalize_ws(evidence_text)
    if len(quote) < 15:
        return False, claimed_page

    pages_to_check = [claimed_page] + [p for p in page_map if p != claimed_page]
    for page in pages_to_check:
        page_text = _normalize_ws(page_map.get(page, ""))
        if not page_text:
            continue
        if quote in page_text:
            return True, page
        # Tolerate small OCR/spacing differences: most words of the quote present.
        words = [w for w in re.findall(r"[a-z0-9.%]+", quote) if len(w) > 2]
        if words:
            hits = sum(1 for w in words if w in page_text)
            if hits / len(words) >= 0.85:
                return True, page
    return False, claimed_page


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def extract_document_facts(filename: str, pages: List[Dict]) -> Tuple[List[Dict], List[str]]:
    """Run the LLM over the document chunks.

    Returns (facts, errors). A chunk that fails does not kill the upload, but the
    caller is told about it so a partial result is never reported as a full one.
    """
    page_map = pdf_service.pages_as_map(pages)
    batches = pdf_service.build_batches(pages)

    facts: List[Dict] = []
    errors: List[str] = []

    log.info("PDF pages: %d | extraction batches: %d", len(pages), len(batches))

    for index, chunk in enumerate(batches, start=1):
        span = chunk["page_numbers"]
        label = f"{span[0]}-{span[-1]}" if span else "?"
        log.info("Processing batch %d/%d: pages %s", index, len(batches), label)

        extracted = None
        # One retry: a malformed structured-output response is often transient,
        # and a batch now covers ~10 pages, so losing one is expensive.
        for attempt in range(config.BATCH_RETRIES + 1):
            try:
                extracted = llm.extract_facts(filename, chunk["text"])
                break
            except Exception as exc:
                if attempt < config.BATCH_RETRIES:
                    log.warning("Batch %d (pages %s) failed (%s); retrying",
                                index, label, type(exc).__name__)
                    continue
                log.warning("Batch %d (pages %s) failed after retry: %s", index, label, exc)
                errors.append(f"pages {label}: {exc}")
        if extracted is None:
            continue

        for item in extracted:
            verified, page = verify_evidence(item.evidence_text, item.page_number, page_map)
            normalized_value, normalized_unit = normalize_value(item.value, item.unit)
            confidence = item.confidence if verified else min(item.confidence, 0.3)
            facts.append(
                {
                    "subject": item.subject,
                    "predicate": item.predicate,
                    "value": item.value,
                    "normalized_value": normalized_value,
                    "normalized_unit": normalized_unit,
                    "unit": item.unit,
                    "value_type": item.value_type,
                    "time_period": item.time_period,
                    "geography": item.geography,
                    "scope": item.scope,
                    "qualifiers": item.qualifiers,
                    "original_text": item.original_text or item.evidence_text,
                    "confidence": confidence,
                    "verified": verified,
                    "_evidence": {
                        "page_number": page,
                        "evidence_text": item.evidence_text,
                        "verified": verified,
                    },
                }
            )

    if not facts and errors:
        raise RuntimeError(f"Fact extraction failed: {errors[0]}")
    return facts, errors


def fact_to_text(fact: Dict) -> str:
    """Compact one-line rendering used for embeddings and for LLM prompts."""
    parts = [
        fact.get("subject"),
        fact.get("predicate"),
        f"= {fact.get('value')}" if fact.get("value") else None,
        fact.get("unit"),
        fact.get("time_period"),
        fact.get("geography"),
        fact.get("scope"),
        fact.get("qualifiers"),
    ]
    return " | ".join(str(p) for p in parts if p)
