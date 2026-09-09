"""LLM access through LangChain: structured fact extraction, comparison, embeddings.

Reasoning (extraction and comparison) goes to whichever provider LLM_PROVIDER
names - ollama, groq, openai or gemini. Everything above this module works
against the same two functions regardless.

Embeddings always run locally with sentence-transformers, so switching the chat
provider never changes the stored vectors.
"""
from functools import lru_cache
from typing import List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from pydantic import BaseModel, Field

from app import config


# --------------------------------------------------------------------------
# Structured output schemas
# --------------------------------------------------------------------------
class ExtractedFact(BaseModel):
    """One atomic fact found in the document. Most fields are optional."""

    subject: str = Field(description="What the fact is about, e.g. 'Delhivery' or 'India CPI inflation'")
    predicate: str = Field(description="The metric or property, e.g. 'revenue from operations'")
    value: str = Field(description="The value exactly as written in the document, e.g. '$10 billion'")
    value_type: Optional[str] = Field(None, description="numeric | monetary | percentage | text")
    unit: Optional[str] = Field(None, description="e.g. 'INR crore', '%', 'billion USD'")
    time_period: Optional[str] = Field(None, description="e.g. 'FY2024', 'Q4 FY24', 'CY2023'")
    geography: Optional[str] = Field(None, description="e.g. 'India', 'global'")
    scope: Optional[str] = Field(None, description="e.g. 'consolidated', 'standalone', 'express parcel segment'")
    qualifiers: Optional[str] = Field(None, description="e.g. 'adjusted', 'estimated', 'provisional'")
    original_text: Optional[str] = Field(None, description="Short paraphrase-free restatement of the fact")
    page_number: int = Field(description="Number on the '--- PAGE n ---' marker the fact came from")
    evidence_text: str = Field(description="Verbatim sentence copied from that page, no rewording")
    confidence: float = Field(0.7, description="0-1 confidence that the fact was read correctly")


class ExtractedFacts(BaseModel):
    facts: List[ExtractedFact] = Field(default_factory=list)


class Judgement(BaseModel):
    pair_id: int = Field(description="the PAIR number being judged")
    relationship: str = Field(description="CORROBORATES | CONTRADICTS | RECONCILES | UNCERTAIN")
    explanation: str = Field(description="One or two sentences explaining the decision")
    confidence: float = Field(0.6)


class Judgements(BaseModel):
    judgements: List[Judgement] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
# Each builder is imported lazily, so you only need the package for the
# provider you actually use. Adding a provider means adding one function here
# and one entry in config.PROVIDER_KEYS.
def _build_ollama() -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=config.OLLAMA_MODEL,
        base_url=config.OLLAMA_BASE_URL,
        temperature=0,
        num_predict=config.LLM_MAX_TOKENS or None,
    )


def _build_groq() -> BaseChatModel:
    from langchain_groq import ChatGroq

    return ChatGroq(
        model=config.GROQ_MODEL,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=config.LLM_MAX_TOKENS or None,
        max_retries=5,  # rides out per-minute rate limits
    )


def _build_openai() -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=config.OPENAI_MODEL,
        api_key=config.OPENAI_API_KEY,
        temperature=0,
        max_tokens=config.LLM_MAX_TOKENS or None,
    )


def _build_gemini() -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=config.GEMINI_MODEL,
        google_api_key=config.GEMINI_API_KEY,
        temperature=0,
        max_output_tokens=config.LLM_MAX_TOKENS or None,
    )


BUILDERS = {
    "ollama": _build_ollama,
    "groq": _build_groq,
    "openai": _build_openai,
    "gemini": _build_gemini,
}

# pip package that provides each builder, for a readable error message.
PACKAGES = {
    "ollama": "langchain-ollama",
    "groq": "langchain-groq",
    "openai": "langchain-openai",
    "gemini": "langchain-google-genai",
}


@lru_cache(maxsize=1)
def _chat() -> BaseChatModel:
    """The chat model for extraction and comparison, per LLM_PROVIDER.

    Cached: rebuilding ChatOllama for every batch was pure overhead once a
    document became a dozen or more calls.
    """
    config.require_env()
    try:
        return BUILDERS[config.LLM_PROVIDER]()
    except ImportError as exc:
        package = PACKAGES.get(config.LLM_PROVIDER, "the provider package")
        raise RuntimeError(
            f"LLM_PROVIDER is '{config.LLM_PROVIDER}' but {package} is not installed. "
            f"Run: pip install {package}"
        ) from exc


@lru_cache(maxsize=1)
def _embeddings() -> HuggingFaceEmbeddings:
    """Local embedding model. Loaded once and reused - loading takes a few seconds."""
    return HuggingFaceEmbeddings(
        model_name=config.EMBEDDING_MODEL,
        # bge models are trained for cosine similarity on normalized vectors,
        # which is what the pgvector index uses.
        encode_kwargs={"normalize_embeddings": True},
    )


def embed(texts: List[str]) -> List[List[float]]:
    """Vectors for pgvector retrieval. Runs locally - Groq has no embeddings API."""
    return _embeddings().embed_documents(texts)


# --------------------------------------------------------------------------
# Chains
# --------------------------------------------------------------------------
EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You extract structured facts from business and economic documents.\n"
            "Rules:\n"
            "- Extract concrete, checkable facts: numbers, percentages, monetary amounts, "
            "dates, named measures. Skip marketing language and opinions.\n"
            "- evidence_text MUST be copied verbatim from the page text. Never invent or reword it.\n"
            "- The text is split by '--- PAGE n ---' markers. page_number MUST be the "
            "number on the marker the evidence sits under. A batch spans several "
            "pages, so read the markers carefully and spread facts across them.\n"
            "- time_period, geography, scope and unit are what make two facts comparable "
            "across documents. A bare number with no period or scope cannot be "
            "checked against anything, so work hard to fill them.\n"
            "- The period or scope is often NOT in the same sentence: take it from the "
            "table column header, the section heading, the statement title "
            "('Consolidated Statement of Profit and Loss'), or the reporting period the "
            "page covers. Use that context.\n"
            "- scope means consolidated vs standalone, group vs segment, reported vs "
            "adjusted, annual vs quarterly. Record it whenever the document makes it "
            "clear, because a difference in scope is what separates a real "
            "contradiction from a reconcilable one.\n"
            "- Still do not invent: if the document genuinely never states a field, "
            "leave it empty rather than guessing.\n"
            "- Return at most {max_facts} of the most meaningful facts.\n"
            "- Keep evidence_text to a single sentence, under 200 characters.\n\n"
            "Keep the fields separate. For the sentence "
            "'Revenue from operations for FY2024 stood at Rs 8,142 crore' the fact is:\n"
            "  subject='Delhivery', predicate='revenue from operations', "
            "value='8,142', unit='INR crore', time_period='FY2024'\n"
            "The predicate is the NAME of the metric only - never put the number in it, "
            "and never put a number in value that does not appear in the text.",
        ),
        ("human", "Document: {filename}\n\nPage text:\n{chunk}"),
    ]
)

COMPARISON_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are given numbered PAIRs. Each pair holds a NEW fact from the document that "
            "was just uploaded and an EXISTING fact from a different document.\n\n"
            "Before deciding, check: same subject? same metric? same time period? same "
            "geography? same scope (consolidated vs segment, annual vs quarterly)? same "
            "unit and currency? same definition (reported vs adjusted)?\n\n"
            "Labels:\n"
            "- CORROBORATES: same context, equivalent value (allow rounding and unit "
            "conversions such as '$5 billion' vs '$5,000 million').\n"
            "- CONTRADICTS: same context in every respect, but values genuinely disagree.\n"
            "- RECONCILES: the two facts describe the SAME measure, the values differ, and "
            "the difference is explained by a stated contextual difference (different "
            "period, region, segment, definition, unit). Do not use RECONCILES for two "
            "facts that simply measure different things - that is UNCERTAIN.\n"
            "- UNCERTAIN: not enough information to decide, or the facts are unrelated.\n\n"
            "A different number is NOT automatically a contradiction. But do not avoid "
            "CONTRADICTS out of caution either: when the subject, metric, period and "
            "scope really do line up and the values still disagree beyond rounding, "
            "label it CONTRADICTS. Judge EVERY pair you are "
            "given, return exactly one judgement per pair_id, and keep each explanation to "
            "one sentence under 160 characters.",
        ),
        ("human", "{pairs}"),
    ]
)


@lru_cache(maxsize=1)
def _extraction_chain():
    """Prompt + structured-output chain, composed once and reused."""
    return EXTRACTION_PROMPT | _chat().with_structured_output(ExtractedFacts)


@lru_cache(maxsize=1)
def _comparison_chain():
    return COMPARISON_PROMPT | _chat().with_structured_output(Judgements)


def extract_facts(filename: str, chunk: str, max_facts: int = 0) -> List[ExtractedFact]:
    result = _extraction_chain().invoke({
        "filename": filename,
        "chunk": chunk,
        "max_facts": max_facts or config.MAX_FACTS_PER_CHUNK,
    })
    return list(result.facts) if result else []


def compare_facts(pairs: str) -> List[Judgement]:
    """One LLM call judges every candidate pair from an upload."""
    result = _comparison_chain().invoke({"pairs": pairs})
    return list(result.judgements) if result else []
