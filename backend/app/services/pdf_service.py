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
            if index > config.MAX_PAGES:
                break
            text = page.get_text("text").strip()
            if text:
                pages.append({"page_number": index, "text": text})

    if not pages:
        raise ValueError("The PDF contains no extractable text (it may be scanned images).")
    return pages


def build_chunks(pages: List[Dict]) -> List[Dict]:
    """Group pages into chunks of ~CHUNK_CHARS so each LLM call sees whole pages.

    A chunk keeps its page markers so the model can cite the right page.
    """
    chunks: List[Dict] = []
    current_pages: List[Dict] = []
    current_len = 0

    def flush():
        if current_pages:
            body = "\n\n".join(
                f"[PAGE {p['page_number']}]\n{p['text']}" for p in current_pages
            )
            chunks.append(
                {
                    "text": body,
                    "page_numbers": [p["page_number"] for p in current_pages],
                }
            )

    for page in pages:
        page_len = len(page["text"])
        if current_pages and current_len + page_len > config.CHUNK_CHARS:
            flush()
            current_pages, current_len = [], 0
        # A single huge page is truncated rather than split mid-sentence forever.
        current_pages.append({**page, "text": page["text"][: config.CHUNK_CHARS]})
        current_len += page_len

    flush()
    return chunks[: config.MAX_CHUNKS]


def pages_as_map(pages: List[Dict]) -> Dict[int, str]:
    return {p["page_number"]: p["text"] for p in pages}
