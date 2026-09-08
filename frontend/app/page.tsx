"use client";

import * as React from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FileText,
  GitCompareArrows,
  Layers,
  LayoutDashboard,
  Library,
  RefreshCw,
  ScanLine,
  Search,
  ServerCrash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Upload from "@/components/Upload";
import FactCard from "@/components/FactCard";
import RelationshipCard from "@/components/RelationshipCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatedNumber } from "@/components/anim/AnimatedNumber";
import { SplitText } from "@/components/anim/SplitText";
import { Badge, toneForRelationship } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getDocuments,
  getFacts,
  getRelationships,
  type Doc,
  type Fact,
  type Relationship,
} from "@/lib/api";
import { useReveal } from "@/lib/motion";
import { cn, relativeTime } from "@/lib/utils";

const PAGE_SIZE = 9;
type TabId = "overview" | "documents" | "relationships" | "facts";

export default function Home() {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");
  const [documents, setDocuments] = React.useState<Doc[]>([]);
  const [facts, setFacts] = React.useState<Fact[]>([]);
  const [relationships, setRelationships] = React.useState<Relationship[]>([]);
  const [documentPage, setDocumentPage] = React.useState(1);
  const [relationshipPage, setRelationshipPage] = React.useState(1);
  const [factPage, setFactPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const [docs, factList, relationshipList] = await Promise.all([
        getDocuments(),
        getFacts(),
        getRelationships(),
      ]);
      setDocuments(docs);
      setFacts(factList);
      setRelationships(relationshipList);
      setDocumentPage(1);
      setRelationshipPage(1);
      setFactPage(1);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Free-text filter across the fields a reader would actually search by.
  const filteredFacts = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facts;
    return facts.filter((fact) =>
      [
        fact.subject,
        fact.predicate,
        fact.value,
        fact.unit,
        fact.time_period,
        fact.geography,
        fact.scope,
        fact.qualifiers,
        fact.document_filename,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [facts, query]);

  React.useEffect(() => setFactPage(1), [query]);

  const slice = <T,>(items: T[], page: number) =>
    items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const verifiedShare = facts.length
    ? Math.round((facts.filter((f) => f.verified).length / facts.length) * 100)
    : 0;
  const contradictions = relationships.filter(
    (r) => r.relationship_type === "CONTRADICTS",
  ).length;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard, count: null },
    { id: "documents" as const, label: "Documents", icon: Library, count: documents.length },
    {
      id: "relationships" as const,
      label: "Correlations",
      icon: GitCompareArrows,
      count: relationships.length,
    },
    { id: "facts" as const, label: "Facts", icon: Layers, count: facts.length },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onRefresh={refresh} refreshing={refreshing} />

      <main className="mx-auto w-full max-w-[1680px] flex-1 px-5 pb-16 sm:px-8 lg:px-12">
        <Hero
          documentCount={documents.length}
          factCount={facts.length}
          linkCount={relationships.length}
          verifiedShare={verifiedShare}
          loading={loading}
        />

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-[13px] text-danger">
            <ServerCrash className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              <p className="mt-1 opacity-80">
                The API is expected at{" "}
                <code className="font-mono">
                  {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
                </code>
                .
              </p>
            </div>
          </div>
        )}

        <Upload onDone={refresh} />

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabId)}
          className="mt-7"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <tab.icon />
                  <span>{tab.label}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {activeTab === "facts" && facts.length > 0 && (
              <label className="group relative flex h-10 w-full items-center sm:w-72">
                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter facts…"
                  className="h-full w-full rounded-full border border-border bg-card/70 pl-9 pr-3 text-[13px] outline-none backdrop-blur-md transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)]"
                />
              </label>
            )}
          </div>

          <TabsContent value="overview">
            <Overview
              loading={loading}
              documents={documents}
              facts={facts}
              relationships={relationships}
              contradictions={contradictions}
              onNavigate={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="documents">
            <Section eyebrow="Source library" title="Documents" count={documents.length}>
              {loading ? (
                <SkeletonGrid />
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={Library}
                  title="No documents yet"
                  body="Upload a PDF to start building your knowledge layer."
                />
              ) : (
                <>
                  <DocumentGrid documents={slice(documents, documentPage)} />
                  <Pagination
                    page={documentPage}
                    total={documents.length}
                    onChange={setDocumentPage}
                  />
                </>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="relationships">
            <Section
              eyebrow="Cross-document analysis"
              title="Correlations"
              count={relationships.length}
            >
              {loading ? (
                <SkeletonGrid />
              ) : relationships.length === 0 ? (
                <EmptyState
                  icon={GitCompareArrows}
                  title="Nothing to correlate yet"
                  body="Upload a second related document to see how claims corroborate, contradict or reconcile."
                />
              ) : (
                <>
                  <RevealList className="grid gap-3.5 2xl:grid-cols-2">
                    {slice(relationships, relationshipPage).map((relationship) => (
                      <RelationshipCard key={relationship.id} relationship={relationship} />
                    ))}
                  </RevealList>
                  <Pagination
                    page={relationshipPage}
                    total={relationships.length}
                    onChange={setRelationshipPage}
                  />
                </>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="facts">
            <Section
              eyebrow="Extracted intelligence"
              title="Facts"
              count={query ? filteredFacts.length : facts.length}
              suffix={query ? `of ${facts.length}` : undefined}
            >
              {loading ? (
                <SkeletonGrid />
              ) : filteredFacts.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title={query ? "No matching facts" : "No facts yet"}
                  body={
                    query
                      ? `Nothing matches “${query}”. Try a broader term.`
                      : "Upload a PDF to extract evidence-backed claims."
                  }
                />
              ) : (
                <>
                  <RevealList className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {slice(filteredFacts, factPage).map((fact) => (
                      <FactCard key={fact.id} fact={fact} />
                    ))}
                  </RevealList>
                  <Pagination
                    page={factPage}
                    total={filteredFacts.length}
                    onChange={setFactPage}
                  />
                </>
              )}
            </Section>
          </TabsContent>
        </Tabs>

        <Pipeline />
      </main>

      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-5 text-[11.5px] text-muted-foreground sm:px-8 lg:px-12">
          <span className="font-mono uppercase tracking-[0.14em]">Fact Knowledge Layer</span>
          <span>Every claim carries its page-level evidence.</span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TopBar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-300",
        // data-scrolled is set on <html> by useScrollDriver.
        "[html[data-scrolled=true]_&]:border-border [html[data-scrolled=true]_&]:bg-background/72 [html[data-scrolled=true]_&]:backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-[12px] font-bold text-primary-foreground">
            FK
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Fact Knowledge Layer
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[11.5px] text-muted-foreground backdrop-blur-md sm:inline-flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            Live workspace
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh data"
              >
                <RefreshCw className={cn(refreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function Hero({
  documentCount,
  factCount,
  linkCount,
  verifiedShare,
  loading,
}: {
  documentCount: number;
  factCount: number;
  linkCount: number;
  verifiedShare: number;
  loading: boolean;
}) {
  const stats = [
    { label: "Sources indexed", value: documentCount, suffix: "" },
    { label: "Facts extracted", value: factCount, suffix: "" },
    { label: "Cross-links", value: linkCount, suffix: "" },
    { label: "Evidence verified", value: verifiedShare, suffix: "%" },
  ];

  return (
    <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-14 lg:py-14">
      <div className="max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-md">
          <Sparkles className="size-3 text-accent" />
          Evidence intelligence
        </p>

        <h1 className="font-display text-[clamp(2.75rem,6.5vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.045em]">
          <SplitText text="Make every document" />
          <br />
          <SplitText
            text="count."
            delay={220}
            wordClassName="bg-linear-to-r from-primary via-info to-accent bg-clip-text text-transparent"
          />
        </h1>

        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground text-pretty">
          Extract grounded facts from your PDFs, then trace how they corroborate,
          contradict and connect across sources.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-6 sm:grid-cols-4 lg:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dd className="font-display text-[2.5rem] font-semibold leading-none tracking-tight text-primary">
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <>
                  <AnimatedNumber value={stat.value} />
                  {stat.suffix && (
                    <span className="text-2xl text-muted-foreground">{stat.suffix}</span>
                  )}
                </>
              )}
            </dd>
            <dt className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Overview({
  loading,
  documents,
  facts,
  relationships,
  contradictions,
  onNavigate,
}: {
  loading: boolean;
  documents: Doc[];
  facts: Fact[];
  relationships: Relationship[];
  contradictions: number;
  onNavigate: (tab: TabId) => void;
}) {
  const metrics = [
    {
      label: "Extracted facts",
      value: facts.length,
      icon: Layers,
      accent: "text-primary bg-primary-soft",
    },
    {
      label: "Cross-document links",
      value: relationships.length,
      icon: GitCompareArrows,
      accent: "text-accent bg-accent/15",
    },
    {
      label: "Contradictions found",
      value: contradictions,
      icon: ScanLine,
      accent: "text-danger bg-danger-soft",
    },
    {
      label: "Source documents",
      value: documents.length,
      icon: Library,
      accent: "text-info bg-info-soft",
    },
  ];

  return (
    <div className="grid gap-3.5">
      <RevealList className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="will-reveal p-5 hover:-translate-y-0.5">
            <div className="relative z-10 flex items-start gap-3.5">
              <span
                className={cn("grid size-9 shrink-0 place-items-center rounded-lg", metric.accent)}
              >
                <metric.icon className="size-4" />
              </span>
              <div>
                <p className="font-display text-3xl font-semibold leading-none">
                  {loading ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <AnimatedNumber value={metric.value} />
                  )}
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">{metric.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </RevealList>

      <RevealList className="grid gap-3.5 lg:grid-cols-2">
        <Card className="will-reveal" spotlight={false}>
          <div className="relative z-10 flex items-end justify-between border-b border-border/70 p-5">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Library
              </p>
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight">
                Recent sources
              </h2>
            </div>
            <span className="font-mono text-[12px] text-muted-foreground">
              {documents.length} total
            </span>
          </div>
          <div className="relative z-10 p-5 pt-1">
            {loading ? (
              <SkeletonRows count={3} />
            ) : documents.length === 0 ? (
              <EmptyState
                compact
                icon={Library}
                title="No documents yet"
                body="Upload a PDF to begin."
              />
            ) : (
              <DocumentList documents={documents.slice(0, 4)} />
            )}
            <Button variant="link" className="mt-3 px-0" onClick={() => onNavigate("documents")}>
              View all sources <ArrowRight />
            </Button>
          </div>
        </Card>

        <Card className="will-reveal" spotlight={false}>
          <div className="relative z-10 flex items-end justify-between border-b border-border/70 p-5">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Analysis
              </p>
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight">
                Correlation map
              </h2>
            </div>
            <span className="font-mono text-[12px] text-muted-foreground">
              {relationships.length} total
            </span>
          </div>
          <div className="relative z-10 p-5">
            {loading ? (
              <SkeletonRows count={2} />
            ) : relationships.length === 0 ? (
              <EmptyState
                compact
                icon={GitCompareArrows}
                title="Nothing correlated yet"
                body="Relationships appear once two related documents are processed."
              />
            ) : (
              <>
                <Badge tone={toneForRelationship[relationships[0].relationship_type] ?? "neutral"}>
                  {relationships[0].relationship_type}
                </Badge>
                <p className="mt-3 line-clamp-5 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                  {relationships[0].explanation}
                </p>
                <Button
                  variant="link"
                  className="mt-3 px-0"
                  onClick={() => onNavigate("relationships")}
                >
                  Explore correlations <ArrowRight />
                </Button>
              </>
            )}
          </div>
        </Card>
      </RevealList>
    </div>
  );
}

/** Explains the pipeline and gives the page a substantial base. */
function Pipeline() {
  const steps = [
    {
      icon: FileSearch,
      title: "Parse",
      body: "Pages are split and text is extracted with positions retained.",
    },
    {
      icon: Sparkles,
      title: "Extract",
      body: "Claims are pulled out as structured subject / predicate / value facts.",
    },
    {
      icon: ShieldCheck,
      title: "Verify",
      body: "Each quote is located back in the source PDF before it is trusted.",
    },
    {
      icon: GitCompareArrows,
      title: "Compare",
      body: "Facts are matched across documents and labelled by relationship.",
    },
  ];

  const ref = useReveal<HTMLDivElement>({ selector: "[data-step]" });

  return (
    <section className="mt-16 border-t border-border/60 pt-10">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        How the layer is built
      </p>
      <div ref={ref} className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} data-step className="will-reveal">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-card text-primary">
                <step.icon className="size-4" />
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <h3 className="font-display text-[15px] font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground text-pretty">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentRow({ doc }: { doc: Doc }) {
  return (
    <div
      data-row
      className="will-reveal group flex items-center gap-3.5 border-b border-border/60 py-3.5 last:border-b-0"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-soft text-info transition-transform duration-300 group-hover:scale-105">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{doc.filename}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {doc.page_count ?? "?"} pages · {relativeTime(doc.uploaded_at)}
        </p>
      </div>
      <Badge tone={doc.status.toLowerCase() === "processing" ? "accent" : "success"}>
        {doc.status}
      </Badge>
    </div>
  );
}

function DocumentList({ documents }: { documents: Doc[] }) {
  const ref = useReveal<HTMLDivElement>({ selector: "[data-row]" });
  return (
    <div ref={ref} className="grid">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

/** Card grid used on the full Documents tab so wide screens stay filled. */
function DocumentGrid({ documents }: { documents: Doc[] }) {
  return (
    <RevealList className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((doc) => (
        <Card key={doc.id} className="will-reveal p-5 hover:-translate-y-0.5">
          <div className="relative z-10 flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{doc.filename}</p>
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {doc.page_count ?? "?"} pages · {relativeTime(doc.uploaded_at)}
              </p>
              <div className="mt-3">
                <Badge tone={doc.status.toLowerCase() === "processing" ? "accent" : "success"}>
                  {doc.status}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </RevealList>
  );
}

function Section({
  eyebrow,
  title,
  count,
  suffix,
  children,
}: {
  eyebrow: string;
  title: string;
  count: number;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
          {count} {suffix ?? "total"}
        </span>
      </div>
      {children}
    </section>
  );
}

/**
 * Wraps a list so its direct children animate in on scroll. useReveal rescans
 * on DOM mutation, so paginating or filtering reveals the new cards too.
 */
function RevealList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useReveal<HTMLDivElement>({ selector: ":scope > *" });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1,
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>

      <div className="flex items-center gap-1">
        {pages.map((n, index) => (
          <React.Fragment key={n}>
            {index > 0 && n - pages[index - 1] > 1 && (
              <span className="px-1 font-mono text-[12px] text-muted-foreground">…</span>
            )}
            <button
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "size-9 rounded-full font-mono text-[12px] transition-colors duration-200",
                n === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {n}
            </button>
          </React.Fragment>
        ))}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-center",
        compact ? "gap-2 px-4 py-9" : "gap-3 px-6 py-20",
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="font-display text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground text-pretty">
        {body}
      </p>
    </div>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3.5 py-2">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-card-border bg-card p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2.5 h-4 w-1/2" />
          <Skeleton className="mt-5 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}
