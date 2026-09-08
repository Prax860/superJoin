"use client";

import * as React from "react";
import { BadgeCheck, ChevronDown, CircleHelp, FileText, Quote } from "lucide-react";
import type { Fact } from "@/lib/api";
import { cn, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Small horizontal meter for a 0..1 confidence score. */
export function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= 0.75 ? "bg-success" : value >= 0.45 ? "bg-accent" : "bg-danger";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5" aria-label={`Confidence ${pct(value)}`}>
          <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full transition-[width] duration-700 ease-out", tone)}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{pct(value)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Model confidence in this extraction</TooltipContent>
    </Tooltip>
  );
}

export function FactSummary({ fact, compact = false }: { fact: Fact; compact?: boolean }) {
  const context = [fact.time_period, fact.geography, fact.scope, fact.qualifiers]
    .filter(Boolean)
    .join(" · ");
  const unit = fact.unit && fact.unit !== fact.value ? fact.unit : "";

  return (
    <div className="min-w-0">
      <p
        className={cn(
          "font-display leading-snug tracking-tight text-balance",
          compact ? "text-[15px]" : "text-[17px]",
        )}
      >
        {fact.subject}
        <span className="text-muted-foreground"> — </span>
        {fact.predicate}
      </p>

      <p className="mt-1.5 font-mono text-[15px] font-medium text-primary">
        {fact.value}
        {unit && <span className="ml-1 text-[13px] text-muted-foreground">{unit}</span>}
      </p>

      {context && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground text-pretty">
          {context}
        </p>
      )}
    </div>
  );
}

export function FactSource({ fact }: { fact: Fact }) {
  const evidence = fact.evidence[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted-foreground">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <FileText className="size-3 shrink-0" />
        <span className="truncate">{fact.document_filename}</span>
      </span>
      {evidence?.page_number != null && (
        <span className="font-mono">p.{evidence.page_number}</span>
      )}
      {fact.confidence != null && <ConfidenceMeter value={fact.confidence} />}
    </div>
  );
}

export default function FactCard({ fact }: { fact: Fact }) {
  const [open, setOpen] = React.useState(false);
  const evidence = fact.evidence[0];

  return (
    <Card className="will-reveal hover:-translate-y-0.5 hover:border-primary/35 hover:elevate-lg">
      <Collapsible open={open} onOpenChange={setOpen} className="relative z-10 p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge tone={fact.verified ? "success" : "accent"}>
            {fact.verified ? <BadgeCheck /> : <CircleHelp />}
            {fact.verified ? "Evidence verified" : "Unverified"}
          </Badge>

          {evidence && (
            <CollapsibleTrigger className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary">
              {open ? "Hide" : "Evidence"}
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-300", open && "rotate-180")}
              />
            </CollapsibleTrigger>
          )}
        </div>

        <div className="mt-3.5">
          <FactSummary fact={fact} />
        </div>

        <div className="mt-3.5 border-t border-border/70 pt-3">
          <FactSource fact={fact} />
        </div>

        <CollapsibleContent>
          {evidence && (
            <figure className="mt-3 rounded-lg border-l-2 border-primary/60 bg-muted/50 p-3">
              <Quote className="mb-1.5 size-3.5 text-primary/70" />
              <blockquote className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                {evidence.evidence_text}
              </blockquote>
              <figcaption className="mt-2 text-[11.5px] text-muted-foreground">
                {fact.document_filename}
                {evidence.page_number != null && `, page ${evidence.page_number}`}
                {!evidence.verified && (
                  <span className="text-danger">
                    {" "}
                    — quote could not be located in the PDF text
                  </span>
                )}
              </figcaption>
            </figure>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
