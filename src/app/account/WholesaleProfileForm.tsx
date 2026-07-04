"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none";

export function WholesaleProfileForm({
  initial,
}: {
  initial: { companyName: string; businessType: string; resaleCertificate: string; resaleState: string; taxId: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(
    initial ?? { companyName: "", businessType: "", resaleCertificate: "", resaleState: "", taxId: "" }
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  if (!open) {
    return (
      <div>
        {initial && (
          <dl className="mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-mist-400">Company</dt><dd className="text-mist-200">{initial.companyName}</dd></div>
            {initial.businessType && (
              <div className="flex justify-between"><dt className="text-mist-400">Business type</dt><dd className="text-mist-200">{initial.businessType}</dd></div>
            )}
          </dl>
        )}
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {initial ? "Edit business profile" : "Set up business profile"}
        </Button>
      </div>
    );
  }

  async function save() {
    if (!f.companyName.trim()) {
      setMsg({ tone: "err", text: "Company name is required." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/marketplace/api/account/wholesale-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: f.companyName.trim(),
          businessType: f.businessType.trim() || undefined,
          resaleCertificate: f.resaleCertificate.trim() || undefined,
          resaleState: f.resaleState.trim() || undefined,
          taxId: f.taxId.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "err", text: body?.error?.message ?? "Save failed." });
        return;
      }
      setMsg({ tone: "ok", text: "Business profile saved. Vendors see it when you request wholesale access." });
      setOpen(false);
      router.refresh();
    } catch {
      setMsg({ tone: "err", text: "Network error — nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input aria-label="Company name" placeholder="Company name *" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} className={inputCls} />
      <input aria-label="Business type" placeholder="Business type (retailer, distributor…)" value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })} className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="Resale certificate number" placeholder="Resale cert #" value={f.resaleCertificate} onChange={(e) => setF({ ...f, resaleCertificate: e.target.value })} className={inputCls} />
        <input aria-label="Resale certificate state" placeholder="Cert state" value={f.resaleState} onChange={(e) => setF({ ...f, resaleState: e.target.value })} className={inputCls} />
      </div>
      <input aria-label="Tax ID" placeholder="Tax ID (optional)" value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} className={inputCls} />
      {msg && <p className={`text-sm ${msg.tone === "ok" ? "text-jade-300" : "text-signal-red"}`}>{msg.text}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save profile"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
