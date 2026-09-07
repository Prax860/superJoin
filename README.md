# Superjoin Fact Knowledge Layer

A fact knowledge layer for PDFs. Upload a document, and the system extracts structured facts
with page-level evidence, stores them in Supabase (pgvector), then compares each new fact with
semantically similar facts already extracted from *other* documents.

```
FACT -> EVIDENCE -> RELATED FACT -> RELATIONSHIP -> EXPLANATION
```

It is not a chatbot. There is no chat box, only documents, facts, evidence and relationships.

## Stack

| Layer     | Choice                                        |
|-----------|-----------------------------------------------|
| Frontend  | Next.js (App Router), React, TypeScript       |
| Backend   | Python, FastAPI, PyMuPDF                      |
| LLM       | Groq (default) or Gemini, via LangChain       |
| Embedding | Gemini `gemini-embedding-001`, 768-dim output |
| Database  | Supabase PostgreSQL + pgvector                |

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of [backend/schema.sql](backend/schema.sql).
   It enables `pgvector`, creates the `documents`, `facts`, `evidence` and `relationships`
   tables, and creates the `match_facts` similarity-search function.
3. From **Project Settings > API**, copy the **Project URL** (`https://<ref>.supabase.co` -
   not the Postgres connection string) and a secret API key.

### 2. Environment

```bash
cp .env.example .env
```

Fill in:

```
LLM_PROVIDER=groq         # groq | gemini
GROQ_API_KEY=...          # https://console.groq.com/keys
GEMINI_API_KEY=...        # https://aistudio.google.com/apikey
SUPABASE_URL=...
SUPABASE_KEY=...          # secret / service_role key, backend only
NEXT_PUBLIC_API_URL=http://localhost:8000
```

All keys are read by the backend only and are never sent to the browser.

Groq model IDs change as models are retired - if you see `model_not_found`, list what your key
can use with:

```bash
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

and set `GROQ_MODEL` in `.env` accordingly.

**Why two providers.** Fact extraction and comparison run on Groq, whose free tier allows
roughly a thousand requests a day; Gemini's free tier stops at 20 per model per day, which is
not enough to demo a couple of uploads. Groq has no embeddings API, so embeddings still come
from Gemini - those use a separate and much larger quota. Set `LLM_PROVIDER=gemini` to run
everything on Gemini instead; the code path is identical
([llm.py](backend/app/llm/llm.py)).

### 3. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: <http://localhost:8000/docs>

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. Sample PDFs are in [data/](data/) - upload two documents from the
same folder to see cross-document relationships.

## API

| Method | Route                | Purpose                                       |
|--------|----------------------|-----------------------------------------------|
| POST   | `/documents/upload`  | Full pipeline for one PDF, returns the result |
| GET    | `/documents`         | Uploaded documents and their status           |
| GET    | `/facts`             | Facts with their evidence (`?document_id=`)   |
| GET    | `/relationships`     | Relationships with both facts expanded        |

Processing is synchronous - no queues, no workers.

## Approach

1. **PDF to text.** PyMuPDF reads the file page by page
   ([pdf_service.py](backend/app/services/pdf_service.py)). Pages are grouped into chunks that
   carry `[PAGE n]` markers, so a page number is attached to every piece of text the LLM sees.
2. **Fact extraction.** A LangChain prompt with `with_structured_output(...)` returns a
   Pydantic `ExtractedFacts` object: subject, predicate, value, unit, time period, geography,
   scope, qualifiers, confidence, page number and a verbatim evidence quote.
3. **Evidence verification.** The model's quote is *not* trusted. `verify_evidence` searches the
   real extracted text - first the claimed page, then every other page. If the quote is found
   elsewhere the real page number replaces the reported one; if it cannot be found at all, the
   fact is stored as `verified = false`, its confidence is capped at 0.3, and it is excluded from
   cross-document comparison. The UI labels it `UNVERIFIED`.
4. **Normalization.** `normalize_value` parses the number and its magnitude word - thousand,
   lakh, million, crore, billion, trillion - plus currency and percent, and stores a
   `normalized_value` in a base unit. `$5 billion` and `$5,000 million` both become
   `5e9 USD`. The original string is always preserved in `facts.value`.
5. **Retrieval.** Each fact is embedded and matched against stored facts with the `match_facts`
   pgvector function (cosine distance), excluding the current document. Only the top 3 candidates
   per fact are kept, and anything below a similarity threshold is dropped without asking the
   model - never every fact against every other fact.
6. **Comparison.** All surviving pairs from one upload are judged in a **single** LLM call
   ([comparison_service.py](backend/app/services/comparison_service.py)). The pair budget is
   filled rank by rank - every fact's best match first - so it is spread across the document
   rather than spent on the first few facts. The prompt is explicitly instructed
   to check subject, metric, period, geography, scope, unit, definition and qualifiers before
   labelling each pair `CORROBORATES`, `CONTRADICTS`, `RECONCILES` or `UNCERTAIN`, with a short
   explanation. Anything the model returns outside those four labels is stored as `UNCERTAIN`.
7. **Display.** The frontend shows facts with their evidence and a side-by-side relationship view
   with a "Why?" explanation.

## The four required cases

**Corroboration** - two documents state the same metric for the same period with equivalent
values, possibly in different wording or units: "Revenue reached $10 billion in 2024" vs
"2024 revenue was approximately $10B". Normalization makes the values comparable and the model
confirms the surrounding context matches.

**Contradiction** - same subject, metric, period, scope and unit, but the values genuinely
disagree: "Revenue in 2024 was $10 billion" vs "Revenue in 2024 was $7 billion". Both facts
and both evidence quotes are shown side by side so the disagreement is checkable at the source.

**Reconciliation** - the values differ, but a contextual difference explains it: FY2024 vs
FY2025, annual vs quarterly, consolidated vs segment, India vs global, reported vs adjusted, or
different units. The prompt is written so a different number is never treated as a contradiction
by itself; the explanation names the difference.

**Extraction / reasoning failure** - handled instead of hidden. A PDF with no text layer, an
empty file or a non-PDF is rejected with a clear message. If Gemini fails on a chunk the other
chunks still process. If the structured response is unusable the upload returns a readable error
and the document is marked `failed`. If an evidence quote cannot be found in the PDF text the
fact is kept but marked unverified and never used for comparison. If a comparison call fails the
pair is recorded as `UNCERTAIN` with an explanation rather than a guessed relationship. The model
is also told to answer `UNCERTAIN` when, for example, one fact's reporting period is unknown and
a contradiction therefore cannot be established.

## Limitations

- Free tiers are rate limited, so an upload is deliberately cheap: at most `MAX_CHUNKS`
  extraction calls plus **one** call for all comparisons. Gemini's free tier is only 20
  requests per day per model, which is why Groq is the default reasoning provider.
- Prototype scale: only the first 40 pages and 6 chunks of a PDF are sent to the LLM
  (`MAX_PAGES` / `MAX_CHUNKS` in [config.py](backend/app/config.py)), so long filings are only
  partially covered. Raise the limits at the cost of time and tokens.
- Scanned/image PDFs are rejected - there is no OCR.
- Table-heavy pages flatten into text, so some numbers lose their column headers.
- Normalization covers common currency, percent and magnitude cases, not every unit system.
- Relationships are only computed at upload time, and only from the new document towards older
  ones; existing pairs are not re-evaluated when a later document adds context.
- Comparison quality depends on the LLM. Values are grounded in verified quotes, but the
  relationship label and explanation are model judgements, not proofs.
- No authentication, no tests, no background processing - deliberately out of scope.
