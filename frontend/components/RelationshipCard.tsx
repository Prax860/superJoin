"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  CircleCheck,
  CircleHelp,
  Handshake,
  Lightbulb,
  Zap,
} from "lucide-react";
import type { Relationship, RelationshipType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge, toneForRelationship } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfidenceMeter, FactSource, FactSummary } from "./FactCard";

const RELATIONSHIP_ICON: Record<RelationshipType, React.ComponentType<{ className?: string }>> = {
  CORROBORATES: CircleCheck,
  CONTRADICTS: Zap,
  RECONCILES: Handshake,
  UNCERTAIN: CircleHelp,
};

/** Left border accent so the verdict is readable at a glance while scanning. */
const RELATIONSHIP_EDGE: Record<RelationshipType, string> = {
  CORROBORATES: "before:bg-success",
  CONTRADICTS: "before:bg-danger",
  RECONCILES: "before:bg-info",
  UNCERTAIN: "before:bg-neutral",
};

function Pane({ label, fact }: { label: string; fact: Relationship["fact_a"] }) {
  const evidence = fact.evidence[0];
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/45 p-3.5 transition-colors duration-300 hover:border-primary/30 hover:bg-background/70">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <FactSummary fact={fact} compact />
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <FactSource fact={fact} />
      </div>
      {evidence && (
        <blockquote className="mt-2.5 line-clamp-3 border-l-2 border-border pl-2.5 text-[12px] leading-relaxed text-muted-foreground">
          {evidence.evidence_text}
        </blockquote>
      )}
    </div>
  );
}

export default function RelationshipCard({ relationship }: { relationship: Relationship }) {
  const Icon = RELATIONSHIP_ICON[relationship.relationship_type] ?? CircleHelp;

  return (
    <Card
      className={cn(
        "will-reveal pl-1 transition-transform duration-300 hover:-translate-y-0.5 hover:elevate-lg",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        RELATIONSHIP_EDGE[relationship.relationship_type],
      )}
      spotlight={false}
    >
      <div className="relative z-10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={toneForRelationship[relationship.relationship_type] ?? "neutral"}>
            <Icon />
            {relationship.relationship_type}
          </Badge>
          {relationship.confidence != null && (
            <ConfidenceMeter value={relationship.confidence} />
          )}
        </div>

        <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Pane label="Fact A" fact={relationship.fact_a} />
          <div className="flex items-center justify-center md:flex-col">
            <span className="hidden h-full w-px bg-border md:block" />
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground md:-my-4">
              <ArrowLeftRight className="size-3.5" />
            </span>
            <span className="hidden h-full w-px bg-border md:block" />
          </div>
          <Pane label="Fact B" fact={relationship.fact_b} />
        </div>

        {relationship.explanation && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/60 p-3.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-[13px] leading-relaxed text-foreground/90 text-pretty">
              <span className="font-medium">Why? </span>
              {relationship.explanation}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
