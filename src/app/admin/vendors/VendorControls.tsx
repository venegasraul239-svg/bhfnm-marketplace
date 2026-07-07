"use client";

// Superadmin controls for one store: suspend/reinstate, commission override,
// rolling-reserve adjustment. Every action is audit-logged server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function VendorControls({ vendorId, status }: { vendorId: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [commission, setCommission] = useState("");
  const [reserve, setReserve] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/marketplace/api/admin/vendors/${vendorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(body?.error?.message ?? "Action failed.");
        return;
      }
      setNote("Done.");
      router.refresh();
    } catch {
      setNote("Network error — nothing changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-jade-300 hover:underline">
        {open ? "Hide controls" : "Controls"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-ink-700 bg-ink-800/50 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {status === "active" ? (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => act({ action: "suspend", reason: reason || undefined })}>
                Suspend store
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => act({ action: "reinstate" })}>
                Reinstate store
              </Button>
            )}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (kept on record)"
              className="min-w-40 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-mist-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Commission % (e.g. 10)" inputMode="decimal" className="w-40 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-mist-100" />
            <Button size="sm" variant="secondary" disabled={busy || !commission} onClick={() => act({ action: "set_commission", commissionRate: parseFloat(commission) / 100 })}>
              Set commission
            </Button>
            <input value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder="Reserve % (e.g. 15)" inputMode="decimal" className="w-36 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-mist-100" />
            <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" inputMode="numeric" className="w-20 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-mist-100" />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || (!reserve && !days)}
              onClick={() =>
                act({
                  action: "set_reserve",
                  ...(reserve && { reservePct: parseFloat(reserve) / 100 }),
                  ...(days && { rollingDays: parseInt(days, 10) }),
                  reason: reason || undefined,
                })
              }
            >
              Set reserve
            </Button>
          </div>
          {note && <p className="text-mist-300">{note}</p>}
        </div>
      )}
    </div>
  );
}
