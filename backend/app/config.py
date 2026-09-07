"""Environment configuration. Secrets never live in code."""
import os
from pathlib import Path

from dotenv import load_dotenv

# .env lives at the repo root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv()  # also allow backend/.env

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Which provider answers the reasoning calls (fact extraction and comparison):
# "groq" or "gemini". Groq's free tier is far more generous than Gemini's.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.6-flash")

# Embeddings always come from Gemini: Groq does not serve an embeddings API.
# Embedding requests use a separate, much larger quota than chat requests.
EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
# gemini-embedding-001 returns 3072 dims by default; we ask for 768 to match
# the vector(768) column in schema.sql (pgvector ivfflat caps out at 2000).
EMBEDDING_DIM = int(os.getenv("GEMINI_EMBEDDING_DIM", "768"))

# How many pages of a PDF we send to the LLM, and how many similar facts we
# compare a new fact against. Kept small so a demo upload stays fast.
MAX_PAGES = int(os.getenv("MAX_PAGES", "40"))
CHUNK_CHARS = int(os.getenv("CHUNK_CHARS", "6000"))
MAX_CHUNKS = int(os.getenv("MAX_CHUNKS", "6"))
TOP_K_SIMILAR = int(os.getenv("TOP_K_SIMILAR", "3"))
MAX_COMPARED_FACTS = int(os.getenv("MAX_COMPARED_FACTS", "25"))
# Candidates below this cosine similarity are not worth asking the LLM about.
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))
# All pairs are judged in ONE LLM call, so this caps the size of that prompt.
MAX_PAIRS = int(os.getenv("MAX_PAIRS", "15"))


def chat_model_name() -> str:
    """The model actually used for extraction and comparison."""
    return GROQ_MODEL if LLM_PROVIDER == "groq" else GEMINI_CHAT_MODEL


def require_env() -> None:
    required = [
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_KEY", SUPABASE_KEY),
        # Needed for embeddings regardless of the chat provider.
        ("GEMINI_API_KEY", GEMINI_API_KEY),
    ]
    if LLM_PROVIDER == "groq":
        required.append(("GROQ_API_KEY", GROQ_API_KEY))

    missing = [name for name, value in required if not value]
    if missing:
        raise RuntimeError(
            "Missing environment variables: " + ", ".join(missing) + ". See .env.example"
        )
    if LLM_PROVIDER not in ("groq", "gemini"):
        raise RuntimeError(f"LLM_PROVIDER must be 'groq' or 'gemini', got '{LLM_PROVIDER}'")
