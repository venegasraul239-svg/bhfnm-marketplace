"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function VerifyPanel({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(action: "verify" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/marketplace/api/admin/compliance/${recordId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(notes.trim() && { notes: notes.trim() }) }),
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

  if (done) return <p className="text-sm font-semibold text-jade-300">Recorded: {done}.</p>;

  return (
    <div className="space-y-2">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewer notes (internal)"
        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => act("verify")}>Verify COA</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => act("reject")}>Reject</Button>
      </div>
      {error && <p className="text-sm text-signal-red">{error}</p>}
    </div>
  );
}
