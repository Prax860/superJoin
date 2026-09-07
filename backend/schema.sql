-- Superjoin Fact Knowledge Layer - Supabase schema
-- Run this once in the Supabase SQL editor.

create extension if not exists vector;

create table if not exists documents (
    id          bigserial primary key,
    filename    text        not null,
    uploaded_at timestamptz not null default now(),
    status      text        not null default 'processing',
    page_count  int
);

create table if not exists facts (
    id               bigserial primary key,
    document_id      bigint      not null references documents(id) on delete cascade,
    subject          text,
    predicate        text,
    value            text,           -- value exactly as written in the document
    normalized_value double precision, -- value converted to a base unit, when numeric
    normalized_unit  text,
    unit             text,
    value_type       text,           -- numeric | percentage | monetary | text ...
    time_period      text,
    geography        text,
    scope            text,
    qualifiers       text,
    original_text    text,           -- the sentence Gemini extracted the fact from
    confidence       double precision,
    verified         boolean     not null default false,
    embedding        vector(768),
    created_at       timestamptz not null default now()
);

create table if not exists evidence (
    id            bigserial primary key,
    fact_id       bigint not null references facts(id) on delete cascade,
    page_number   int,
    evidence_text text,
    verified      boolean not null default false
);

create table if not exists relationships (
    id                bigserial primary key,
    fact_a_id         bigint not null references facts(id) on delete cascade,
    fact_b_id         bigint not null references facts(id) on delete cascade,
    relationship_type text   not null, -- CORROBORATES | CONTRADICTS | RECONCILES | UNCERTAIN
    explanation       text,
    confidence        double precision,
    created_at        timestamptz not null default now()
);

create index if not exists facts_document_id_idx on facts(document_id);
create index if not exists evidence_fact_id_idx on evidence(fact_id);
create index if not exists relationships_fact_a_idx on relationships(fact_a_id);

-- Vector similarity index (cosine).
create index if not exists facts_embedding_idx
    on facts using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Similarity search used by the retrieval step.
-- Returns facts from OTHER documents that are semantically close to a new fact.
create or replace function match_facts (
    query_embedding vector(768),
    exclude_document_id bigint,
    match_count int default 5
)
returns table (
    id bigint,
    document_id bigint,
    subject text,
    predicate text,
    value text,
    normalized_value double precision,
    normalized_unit text,
    unit text,
    time_period text,
    geography text,
    scope text,
    qualifiers text,
    original_text text,
    confidence double precision,
    similarity double precision
)
language sql stable
as $$
    select f.id, f.document_id, f.subject, f.predicate, f.value,
           f.normalized_value, f.normalized_unit, f.unit, f.time_period,
           f.geography, f.scope, f.qualifiers, f.original_text, f.confidence,
           1 - (f.embedding <=> query_embedding) as similarity
    from facts f
    where f.embedding is not null
      and (exclude_document_id is null or f.document_id <> exclude_document_id)
    order by f.embedding <=> query_embedding
    limit match_count;
$$;
