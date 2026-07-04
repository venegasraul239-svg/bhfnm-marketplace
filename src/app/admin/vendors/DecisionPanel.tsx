"use client";

// Approve / request-info / reject controls for one application.
// Calls the admin decision API and reflects real outcomes — no optimistic fakes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const REASONS = [
  ["incomplete_docs", "Incomplete documentation"],
  ["unverifiable_identity", "Unverifiable identity"],
  ["prohibited_products", "Prohibited products"],
  ["jurisdiction", "Jurisdiction"],
  ["fraud_signals", "Fraud signals"],
  ["other", "Other"],
] as const;

export function DecisionPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "info" | "reject">("idle");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string>("incomplete_docs");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(action: "approve" | "reject" | "request_info") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/marketplace/api/admin/applications/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" && { reasonCode: reason }),
          ...(note.trim() && { note: note.trim() }),
        }),
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

  if (done) {
    return <p className="text-sm font-semibold text-jade-300">Decision recorded: {done}.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => decide("approve")}>
          Approve & provision store
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMode(mode === "info" ? "idle" : "info")}>
          Request information
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => setMode(mode === "reject" ? "idle" : "reject")}>
          Reject
        </Button>
      </div>

      {mode !== "idle" && (
        <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-800/50 p-3">
          {mode === "reject" && (
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Rejection reason"
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100"
            >
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          )}
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "info" ? "What do you need from the applicant? (sent to their status page)" : "Optional note shown to the applicant"}
            className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500"
          />
          <Button
            size="sm"
            variant={mode === "reject" ? "danger" : "primary"}
            disabled={busy || (mode === "info" && !note.trim())}
            onClick={() => decide(mode === "reject" ? "reject" : "request_info")}
          >
            {busy ? "Working…" : mode === "reject" ? "Confirm rejection" : "Send request"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-signal-red">{error}</p>}
    </div>
  );
}
