"""LLM access through LangChain: structured fact extraction, comparison, embeddings.

Reasoning calls go to Groq or Gemini (set LLM_PROVIDER). Embeddings always go to
Gemini, because Groq does not serve an embeddings API.
"""
from typing import List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings
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
    page_number: int = Field(description="The [PAGE n] marker the fact came from")
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
def _chat() -> BaseChatModel:
    """The reasoning model, chosen by LLM_PROVIDER."""
    config.require_env()
    if config.LLM_PROVIDER == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=config.GROQ_MODEL,
            api_key=config.GROQ_API_KEY,
            temperature=0,
        )

    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=config.GEMINI_CHAT_MODEL,
        google_api_key=config.GEMINI_API_KEY,
        temperature=0,
    )


def _embeddings() -> GoogleGenerativeAIEmbeddings:
    config.require_env()
    return GoogleGenerativeAIEmbeddings(
        model=config.EMBEDDING_MODEL,
        google_api_key=config.GEMINI_API_KEY,
    )


def embed(texts: List[str]) -> List[List[float]]:
    return _embeddings().embed_documents(texts, output_dimensionality=config.EMBEDDING_DIM)


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
            "- page_number MUST be the [PAGE n] marker the evidence appears under.\n"
            "- Fill time_period, geography, scope, unit and qualifiers only when the document "
            "states or clearly implies them. Leave them empty otherwise - do not guess.\n"
            "- Return at most {max_facts} of the most meaningful facts.",
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
            "- RECONCILES: values differ, and the difference is explained by a contextual "
            "difference (different period, region, segment, definition, unit).\n"
            "- UNCERTAIN: not enough information to decide, or the facts are unrelated.\n\n"
            "A different number is NOT automatically a contradiction. Judge EVERY pair you are "
            "given, return exactly one judgement per pair_id, and explain each decision in one "
            "or two sentences.",
        ),
        ("human", "{pairs}"),
    ]
)


def extract_facts(filename: str, chunk: str, max_facts: int = 8) -> List[ExtractedFact]:
    chain = EXTRACTION_PROMPT | _chat().with_structured_output(ExtractedFacts)
    result = chain.invoke({"filename": filename, "chunk": chunk, "max_facts": max_facts})
    return list(result.facts) if result else []


def compare_facts(pairs: str) -> List[Judgement]:
    """One LLM call judges every candidate pair from an upload."""
    chain = COMPARISON_PROMPT | _chat().with_structured_output(Judgements)
    result = chain.invoke({"pairs": pairs})
    return list(result.judgements) if result else []
