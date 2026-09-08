"use client";

import * as React from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteDocument, type Doc } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Removes a document from the knowledge layer, behind a confirmation.
 *
 * Deleting cascades to that document's facts, evidence and cross-document
 * relationships, so the dialog spells out what goes with it.
 */
export function DeleteDocumentButton({
  doc,
  onDeleted,
}: {
  doc: Doc;
  onDeleted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await deleteDocument(doc.id);
      setOpen(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never let the dialog close mid-request, or the result is invisible.
        if (busy) return;
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${doc.filename}`}
          title={`Remove ${doc.filename}`}
          className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogTitle>Remove this document?</DialogTitle>
        <DialogDescription>
          <span className="font-mono text-foreground">{doc.filename}</span> and everything
          derived from it — its facts, their evidence and every cross-document
          relationship touching it — will be deleted. This cannot be undone.
        </DialogDescription>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-2.5 text-[12.5px] text-danger">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={confirm}
            disabled={busy}
            className="bg-danger text-white hover:brightness-110"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {busy ? "Removing…" : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
