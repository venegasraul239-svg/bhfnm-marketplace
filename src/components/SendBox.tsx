"use client";

// Inbox composer. Messages are immutable once sent and pass off-platform
// contact detection server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function SendBox({ threadId, vendorSlug }: { threadId?: string; vendorSlug?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/marketplace/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(threadId ? { threadId } : { vendorSlug }), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ tone: "err", text: data?.error?.message ?? "Send failed — try again." });
        return;
      }
      setBody("");
      if (data.warning) setNote({ tone: "warn", text: data.warning });
      if (!threadId && data.threadId) {
        router.push(`?t=${data.threadId}`);
      }
      router.refresh();
    } catch {
      setNote({ tone: "err", text: "Network error — message not sent." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a message… (keep communication on-platform — contact details are flagged)"
        aria-label="Message"
        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none"
      />
      {note && (
        <p
          className={`mt-2 text-sm ${
            note.tone === "warn" ? "text-amber-glow" : note.tone === "err" ? "text-signal-red" : "text-jade-300"
          }`}
          role="status"
        >
          {note.text}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={busy || !body.trim()} onClick={send}>
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
