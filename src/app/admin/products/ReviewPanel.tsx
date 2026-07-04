"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ReviewPanel({ productId }: { productId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function review(action: "approve" | "reject" | "request_changes") {
    if (action !== "approve" && !note.trim()) {
      setError("Add a note explaining the decision first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/marketplace/api/admin/products/${productId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(note.trim() && { note: note.trim() }) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Action failed.");
        return;
      }
      setDone(body.status);
      router.refresh();
    } catch {
      setError("Network error — nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="text-sm font-semibold text-jade-300">Decision recorded: {done}.</p>;

  return (
    <div className="space-y-2">
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reviewer note (required for reject / request changes; shown to the vendor)"
        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => review("approve")}>Approve → live</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => review("request_changes")}>Request changes</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => review("reject")}>Reject</Button>
      </div>
      {error && <p className="text-sm text-signal-red">{error}</p>}
    </div>
  );
}
