"""PDF text extraction with PyMuPDF. Page numbers are preserved everywhere."""
from typing import List, Dict

import fitz  # PyMuPDF

from app import config


def extract_pages(pdf_bytes: bytes) -> List[Dict]:
    """Return [{"page_number": 1, "text": "..."}, ...] for pages that have text."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # not a PDF / corrupted file
        raise ValueError(f"Could not read the PDF: {exc}") from exc

    pages = []
    with doc:
        for index, page in enumerate(doc, start=1):
            # MAX_PAGES == 0 means "read every page".
            if config.MAX_PAGES and index > config.MAX_PAGES:
                break
            text = page.get_text("text").strip()
            if text:
                pages.append({"page_number": index, "text": text})

    if not pages:
        raise ValueError("The PDF contains no extractable text (it may be scanned images).")
    return pages


PAGE_MARKER = "--- PAGE {n} ---"


def _split_oversized(page: Dict, limit: int) -> List[Dict]:
    """Split a page larger than one whole batch into parts.

    Nothing is discarded - the previous implementation truncated such a page at
    CHUNK_CHARS. Each part keeps the same page number, so the page still counts
    as covered.
    """
    text = page["text"]
    if len(text) <= limit:
        return [page]
    pieces = [text[i : i + limit] for i in range(0, len(text), limit)]
    return [
        {"page_number": page["page_number"], "text": piece}
        for piece in pieces
        if piece.strip()
    ]


def build_batches(pages: List[Dict]) -> List[Dict]:
    """Group pages into extraction batches of about BATCH_PAGES pages each.

    Each batch is one LLM call and carries `--- PAGE n ---` markers so the model
    can cite the right page. Batching by page count rather than character count
    is what keeps a 100-page PDF near 10-15 calls; BATCH_MAX_CHARS closes a
    batch early when a run of dense pages would otherwise build a huge prompt.
    """
    target_pages = max(1, config.BATCH_PAGES)
    limit = max(config.BATCH_MAX_CHARS, 2000)

    batches: List[Dict] = []
    current: List[Dict] = []
    current_chars = 0
    current_pages: set = set()

    def flush() -> None:
        nonlocal current, current_chars, current_pages
        if not current:
            return
        body = "\n\n".join(
            f"{PAGE_MARKER.format(n=unit['page_number'])}\n{unit['text']}" for unit in current
        )
        batches.append({"text": body, "page_numbers": sorted(current_pages)})
        current, current_chars, current_pages = [], 0, set()

    for page in pages:
        if not page["text"].strip():
            continue
        for unit in _split_oversized(page, limit):
            unit_len = len(unit["text"])
            if current and (
                len(current_pages) >= target_pages or current_chars + unit_len > limit
            ):
                flush()
            current.append(unit)
            current_chars += unit_len
            current_pages.add(unit["page_number"])

    flush()

    if config.MAX_CHUNKS:
        batches = batches[: config.MAX_CHUNKS]
    return batches


def pages_as_map(pages: List[Dict]) -> Dict[int, str]:
    return {p["page_number"]: p["text"] for p in pages}
