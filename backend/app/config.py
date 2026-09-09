"""Environment configuration. Secrets never live in code."""
import os
from pathlib import Path

from dotenv import load_dotenv

# .env lives at the repo root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv()  # also allow backend/.env

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# --------------------------------------------------------------------------
# Reasoning provider (fact extraction and comparison)
#
# Swap providers with one env var - the rest of the app never changes:
#   LLM_PROVIDER=ollama   local, free, no key      (needs the Ollama app running)
#   LLM_PROVIDER=groq     fast, free tier          (GROQ_API_KEY)
#   LLM_PROVIDER=openai                            (OPENAI_API_KEY)
#   LLM_PROVIDER=gemini                            (GEMINI_API_KEY)
#
# Each provider needs its own LangChain package; see requirements.txt.
# --------------------------------------------------------------------------
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").strip().lower()

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Groq's free tier caps tokens-per-day PER MODEL (200k) and, on some models,
# output tokens per minute. If you hit a 429, switch GROQ_MODEL for a fresh
# budget: openai/gpt-oss-120b, qwen/qwen3.8-27b, qwen/qwen3.6-27b.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Cap on output tokens per call. Keeps hosted providers inside per-minute
# limits and stops a local model from rambling. 0 means "no explicit cap".
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "900"))
MAX_FACTS_PER_CHUNK = int(os.getenv("MAX_FACTS_PER_CHUNK", "12"))

# Which env var holds the key for each provider (ollama needs none).
PROVIDER_KEYS = {
    "ollama": None,
    "groq": "GROQ_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}

# Embeddings always run locally with sentence-transformers, independently of
# LLM_PROVIDER. No key and no quota; the weights (~440 MB) are downloaded
# once on first use and cached in ~/.cache/huggingface.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
# bge-base-en-v1.5 outputs 768 dims - this must match the vector(768)
# column in schema.sql. Changing the model means changing both.
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))

# How many pages of a PDF we send to the LLM, and how many similar facts we
# compare a new fact against. Kept small so a demo upload stays fast.
# 0 = no limit. Batching by page count (below) keeps a 100-page PDF to ~10-15
# LLM calls, so truncating the document is no longer needed for speed.
MAX_PAGES = int(os.getenv("MAX_PAGES", "0"))
CHUNK_CHARS = int(os.getenv("CHUNK_CHARS", "4500"))
MAX_CHUNKS = int(os.getenv("MAX_CHUNKS", "0"))

# --------------------------------------------------------------------------
# Extraction batching
#
# One LLM call per ~BATCH_PAGES pages, instead of one per CHUNK_CHARS of text.
# BATCH_MAX_CHARS is the safety valve so a run of text-heavy pages cannot
# build an enormous prompt.
# --------------------------------------------------------------------------
BATCH_PAGES = int(os.getenv("BATCH_PAGES", "10"))
BATCH_MAX_CHARS = int(os.getenv("BATCH_MAX_CHARS", "24000"))
# A batch that fails is retried this many times before its pages are skipped.
BATCH_RETRIES = int(os.getenv("BATCH_RETRIES", "1"))
TOP_K_SIMILAR = int(os.getenv("TOP_K_SIMILAR", "3"))
MAX_COMPARED_FACTS = int(os.getenv("MAX_COMPARED_FACTS", "60"))
# Candidates below this cosine similarity are not worth asking the LLM about.
# Raised from 0.75: at that level unrelated metrics ('customers served' vs
# 'revenue from operations') cleared the bar and consumed the pair budget,
# leaving no room for genuine same-metric comparisons.
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.82"))
# All pairs are judged in ONE LLM call, so this caps the size of that prompt.
MAX_PAIRS = int(os.getenv("MAX_PAIRS", "24"))


def chat_model_name() -> str:
    """The model actually used, whichever provider is selected."""
    return {
        "ollama": OLLAMA_MODEL,
        "groq": GROQ_MODEL,
        "openai": OPENAI_MODEL,
        "gemini": GEMINI_MODEL,
    }.get(LLM_PROVIDER, OLLAMA_MODEL)


def require_env() -> None:
    if LLM_PROVIDER not in PROVIDER_KEYS:
        raise RuntimeError(
            f"LLM_PROVIDER must be one of {sorted(PROVIDER_KEYS)}, got '{LLM_PROVIDER}'"
        )

    required = [("SUPABASE_URL", SUPABASE_URL), ("SUPABASE_KEY", SUPABASE_KEY)]

    # Only the selected provider's key is required. Ollama needs none.
    key_name = PROVIDER_KEYS[LLM_PROVIDER]
    if key_name:
        required.append((key_name, globals().get(key_name, "")))

    missing = [name for name, value in required if not value]
    if missing:
        raise RuntimeError(
            "Missing environment variables: " + ", ".join(missing) + ". See .env.example"
        )
