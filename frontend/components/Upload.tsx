"use client";

import * as React from "react";
import { animate } from "animejs";
import { AlertCircle, CheckCircle2, FileText, Sparkles, TriangleAlert, Upload as UploadIcon, X } from "lucide-react";
import { uploadPdf } from "@/lib/api";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Phase = "idle" | "sending" | "processing" | "done" | "error";

const PROCESSING_STEPS = [
  "Splitting pages",
  "Extracting claims",
  "Locating evidence",
  "Comparing across sources",
];

export default function Upload({ onDone }: { onDone: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [sent, setSent] = React.useState(0);
  const [step, setStep] = React.useState(0);
  const [message, setMessage] = React.useState("");
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const zoneRef = React.useRef<HTMLDivElement | null>(null);
  const dragDepth = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const busy = phase === "sending" || phase === "processing";

  // Cycle the processing captions while the server works, so a long extraction
  // still looks alive. Purely cosmetic — the server reports no real progress.
  React.useEffect(() => {
    if (phase !== "processing") return;
    setStep(0);
    const id = window.setInterval(
      () => setStep((s) => Math.min(s + 1, PROCESSING_STEPS.length - 1)),
      2600,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  const pickFile = React.useCallback((next: File | null) => {
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files can be processed.");
      setPhase("error");
      return;
    }
    setFile(next);
    setError("");
    setMessage("");
    setWarnings([]);
    setPhase("idle");

    const zone = zoneRef.current;
    if (zone && !prefersReducedMotion()) {
      animate(zone, { scale: [1, 1.012, 1], duration: 520, ease: "outElastic(1, 0.6)" });
    }
  }, []);

  async function submit() {
    if (!file) return;
    setPhase("sending");
    setSent(0);
    setError("");
    setMessage("");
    setWarnings([]);

    try {
      const result = await uploadPdf(file, (fraction) => {
        setSent(fraction);
        if (fraction >= 1) setPhase("processing");
      });
      setMessage(result.message);
      setWarnings(result.warnings ?? []);
      setPhase("done");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div
      ref={zoneRef}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "sheen relative rounded-2xl border border-dashed p-5 transition-[border-color,background-color,box-shadow] duration-300",
        dragging
          ? "border-primary bg-primary-soft/45 elevate-lg"
          : "border-border bg-card/55 backdrop-blur-md hover:border-primary/45",
      )}
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform duration-300",
              dragging && "scale-110 rotate-3",
              busy && "animate-pulse-ring",
            )}
          >
            {file ? <FileText className="size-5" /> : <UploadIcon className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] leading-tight">
              {dragging ? "Drop it anywhere here" : "Add a source document"}
            </p>
            <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
              {file ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="truncate font-mono text-foreground">{file.name}</span>
                  <span className="shrink-0">· {(file.size / 1_048_576).toFixed(1)} MB</span>
                </span>
              ) : (
                "Drag a PDF in, or browse. Pages are indexed with evidence."
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {file && !busy && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFile(null);
                setPhase("idle");
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label="Clear selected file"
            >
              <X />
            </Button>
          )}
          <Button variant="outline" size="default" asChild>
            <label className="cursor-pointer">
              {file ? "Change" : "Browse"}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            <Sparkles className={cn(busy && "animate-spin")} />
            {phase === "sending"
              ? `Uploading ${Math.round(sent * 100)}%`
              : phase === "processing"
                ? "Extracting…"
                : "Extract facts"}
          </Button>
        </div>
      </div>

      {busy && (
        <div className="relative z-10 mt-4">
          <Progress
            value={sent * 100}
            indeterminate={phase === "processing"}
            tone={phase === "processing" ? "accent" : "primary"}
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            {phase === "sending"
              ? "Transferring file…"
              : `${PROCESSING_STEPS[step]}… extraction, evidence checks and cross-document comparison run synchronously, so a large PDF can take a minute.`}
          </p>
        </div>
      )}

      {phase === "done" && message && (
        <div
          className={cn(
            "relative z-10 mt-4 flex items-start gap-2.5 rounded-lg border p-3 text-[13px] leading-relaxed",
            warnings.length > 0
              ? "border-accent/35 bg-accent/12 text-accent-foreground dark:text-accent"
              : "border-success/30 bg-success-soft text-success",
          )}
        >
          {warnings.length > 0 ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p>{message}</p>
            {warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 opacity-90">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {phase === "error" && error && (
        <div className="relative z-10 mt-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
