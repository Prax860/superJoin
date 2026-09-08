"use client";

import * as React from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import type { Fact, Relationship, RelationshipType } from "@/lib/api";
import { cn, pct } from "@/lib/utils";
import { Badge, toneForRelationship } from "@/components/ui/badge";

type Node = {
  id: number;
  fact: Fact;
  documentId: number;
  label: string;
  degree: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

type Edge = {
  id: number;
  source: Node | number;
  target: Node | number;
  type: RelationshipType;
  relationship: Relationship;
};

const EDGE_STROKE: Record<RelationshipType, string> = {
  CORROBORATES: "var(--success)",
  CONTRADICTS: "var(--danger)",
  RECONCILES: "var(--info)",
  UNCERTAIN: "var(--neutral)",
};

/** Distinct hues per source document, cycling if there are many. */
const DOC_HUES = [268, 182, 320, 40, 150, 220, 0, 95];

const WIDTH = 1100;
const HEIGHT = 660;
// Labels render below the circle, so the bottom margin is the largest.
const MARGIN_X = 96;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 62;

function nodeId(node: Node | number) {
  return typeof node === "number" ? node : node.id;
}

/**
 * Force-directed view of the knowledge layer: every fact that takes part in a
 * relationship is a node, every relationship an edge coloured by verdict.
 * Node colour is the source document, so a cross-document link is visible as
 * an edge between two colours.
 *
 * The simulation writes positions straight to the DOM on each tick via a
 * re-render; the graph is small (tens of nodes) so this is cheap, and keeping
 * plain SVG elements means hit-testing and accessibility come for free.
 */
export default function CorrelationGraph({
  relationships,
  onSelect,
}: {
  relationships: Relationship[];
  onSelect?: (relationship: Relationship) => void;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<Relationship | null>(null);
  const [filter, setFilter] = React.useState<RelationshipType | "ALL">("ALL");
  const [, forceRender] = React.useReducer((n: number) => n + 1, 0);

  const visible = React.useMemo(
    () =>
      filter === "ALL"
        ? relationships
        : relationships.filter((r) => r.relationship_type === filter),
    [relationships, filter],
  );

  // Rebuilt only when the visible relationships change, because the
  // simulation mutates these objects in place.
  const { nodes, edges, documents } = React.useMemo(() => {
    const nodeMap = new Map<number, Node>();
    const documentIds: number[] = [];

    const add = (fact: Fact) => {
      let node = nodeMap.get(fact.id);
      if (!node) {
        node = {
          id: fact.id,
          fact,
          documentId: fact.document_id,
          label: [fact.subject, fact.predicate].filter(Boolean).join(" · ") || "fact",
          degree: 0,
        };
        nodeMap.set(fact.id, node);
        if (!documentIds.includes(fact.document_id)) documentIds.push(fact.document_id);
      }
      node.degree += 1;
      return node;
    };

    const edgeList: Edge[] = visible.map((relationship) => ({
      id: relationship.id,
      source: add(relationship.fact_a),
      target: add(relationship.fact_b),
      type: relationship.relationship_type,
      relationship,
    }));

    return { nodes: [...nodeMap.values()], edges: edgeList, documents: documentIds };
  }, [visible]);

  const simulationRef = React.useRef<Simulation<Node, undefined> | null>(null);

  React.useEffect(() => {
    if (nodes.length === 0) return;

    const simulation = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Edge>(edges)
          .id((node) => node.id)
          .distance(150)
          .strength(0.55),
      )
      .force("charge", forceManyBody<Node>().strength(-620))
      .force("collide", forceCollide<Node>(46))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("x", forceX(WIDTH / 2).strength(0.045))
      .force("y", forceY(HEIGHT / 2).strength(0.075))
      .on("tick", () => {
        // Clamp inside the viewBox, otherwise the outermost nodes drift off
        // and get clipped by the SVG edge along with their labels.
        for (const node of nodes) {
          node.x = Math.max(MARGIN_X, Math.min(WIDTH - MARGIN_X, node.x ?? 0));
          node.y = Math.max(MARGIN_TOP, Math.min(HEIGHT - MARGIN_BOTTOM, node.y ?? 0));
        }
        forceRender();
      });

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [nodes, edges]);

  // Drag a node: pin it under the pointer, release on pointerup.
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragging = React.useRef<Node | null>(null);

  const toLocal = (event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const onPointerDown = (node: Node) => (event: React.PointerEvent) => {
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragging.current = node;
    simulationRef.current?.alphaTarget(0.28).restart();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const node = dragging.current;
    if (!node) return;
    const { x, y } = toLocal(event);
    node.fx = x;
    node.fy = y;
    forceRender();
  };

  const endDrag = () => {
    const node = dragging.current;
    if (!node) return;
    node.fx = null;
    node.fy = null;
    dragging.current = null;
    simulationRef.current?.alphaTarget(0);
  };

  const neighbours = React.useMemo(() => {
    if (hovered == null) return null;
    const set = new Set<number>([hovered]);
    for (const edge of edges) {
      if (nodeId(edge.source) === hovered) set.add(nodeId(edge.target));
      if (nodeId(edge.target) === hovered) set.add(nodeId(edge.source));
    }
    return set;
  }, [hovered, edges]);

  const counts = React.useMemo(() => {
    const tally: Record<string, number> = {};
    for (const r of relationships) {
      tally[r.relationship_type] = (tally[r.relationship_type] ?? 0) + 1;
    }
    return tally;
  }, [relationships]);

  const filters: (RelationshipType | "ALL")[] = [
    "ALL",
    "CORROBORATES",
    "CONTRADICTS",
    "RECONCILES",
    "UNCERTAIN",
  ];

  return (
    <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
          {filters.map((option) => {
            const count = option === "ALL" ? relationships.length : counts[option] ?? 0;
            return (
              <button
                key={option}
                onClick={() => setFilter(option)}
                disabled={option !== "ALL" && count === 0}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors",
                  filter === option
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  option !== "ALL" && count === 0 && "opacity-40",
                )}
              >
                {option === "ALL" ? "All" : option.toLowerCase()} {count}
              </button>
            );
          })}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-[660px] w-full touch-none select-none"
          role="img"
          aria-label={`Correlation graph with ${nodes.length} facts and ${edges.length} relationships`}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <defs>
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M40 0 H0 V40"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.45"
              />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#graph-grid)" />

          {edges.map((edge) => {
            const source = edge.source as Node;
            const target = edge.target as Node;
            if (source.x == null || target.x == null) return null;
            const active =
              !neighbours || neighbours.has(source.id) || neighbours.has(target.id);
            const isSelected = selected?.id === edge.id;
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={EDGE_STROKE[edge.type]}
                strokeWidth={isSelected ? 3.5 : 2}
                strokeDasharray={edge.type === "UNCERTAIN" ? "5 5" : undefined}
                opacity={active ? (isSelected ? 1 : 0.72) : 0.12}
                className="cursor-pointer transition-opacity"
                onClick={() => {
                  setSelected(edge.relationship);
                  onSelect?.(edge.relationship);
                }}
              />
            );
          })}

          {nodes.map((node) => {
            if (node.x == null || node.y == null) return null;
            const hue = DOC_HUES[documents.indexOf(node.documentId) % DOC_HUES.length];
            const dim = neighbours && !neighbours.has(node.id);
            const radius = 9 + Math.min(node.degree, 5) * 2.4;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                opacity={dim ? 0.2 : 1}
                className="cursor-grab transition-opacity active:cursor-grabbing"
                onPointerDown={onPointerDown(node)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  r={radius + 5}
                  fill={`oklch(0.7 0.16 ${hue})`}
                  opacity={hovered === node.id ? 0.28 : 0}
                />
                <circle
                  r={radius}
                  fill={`oklch(0.68 0.15 ${hue})`}
                  stroke="var(--card)"
                  strokeWidth="2.5"
                />
                {!node.fact.verified && (
                  <circle
                    r={radius + 3.5}
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  y={radius + 15}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground font-sans text-[11px]"
                >
                  {node.label.length > 26 ? `${node.label.slice(0, 26)}…` : node.label}
                </text>
                <text
                  y={radius + 28}
                  textAnchor="middle"
                  className="pointer-events-none fill-muted-foreground font-mono text-[10px]"
                >
                  {node.fact.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="flex flex-col gap-3.5">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Legend
          </p>
          <ul className="mt-3 grid gap-2">
            {(Object.keys(EDGE_STROKE) as RelationshipType[]).map((type) => (
              <li key={type} className="flex items-center gap-2.5 text-[12px]">
                <span
                  className="h-0.5 w-6 shrink-0 rounded"
                  style={{ background: EDGE_STROKE[type] }}
                />
                <span className="text-muted-foreground">{type.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3.5 border-t border-border/70 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Node colour is the source document, size is how many links a fact has.
            A dashed red ring means the quote could not be located in the PDF.
            Drag nodes to rearrange; click an edge for the reasoning.
          </p>
        </div>

        <div className="min-h-40 rounded-xl border border-card-border bg-card p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Selected link
          </p>
          {!selected ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Click any edge in the graph to see the two facts and why the system
              labelled them that way.
            </p>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={toneForRelationship[selected.relationship_type] ?? "neutral"}>
                  {selected.relationship_type}
                </Badge>
                {selected.confidence != null && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {pct(selected.confidence)}
                  </span>
                )}
              </div>
              {[selected.fact_a, selected.fact_b].map((fact, index) => (
                <div key={fact.id} className="mt-3 rounded-lg bg-muted/60 p-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Fact {index === 0 ? "A" : "B"} · {fact.document_filename}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug">
                    {fact.subject} — {fact.predicate}
                  </p>
                  <p className="mt-0.5 font-mono text-[12.5px] text-primary">
                    {fact.value} {fact.unit && fact.unit !== fact.value ? fact.unit : ""}
                  </p>
                </div>
              ))}
              {selected.explanation && (
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
                  {selected.explanation}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
