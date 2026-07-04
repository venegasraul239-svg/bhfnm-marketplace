"use client";

// Draft listing form (single-variant beta flow). Save keeps it a draft;
// "Submit for review" moves it to the admin queue — publication is never
// vendor-controlled.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const CATEGORIES = [
  ["hemp-flower", "Hemp Flower"], ["cbd-flower", "CBD Flower"], ["cbg-flower", "CBG Flower"],
  ["thca-flower", "THCA Flower"], ["pre-rolls", "Hemp Pre-Rolls"], ["thc-drinks", "THC Drinks"],
  ["gummies", "Gummies"], ["edibles", "Edibles"], ["vapes", "Vapes"], ["concentrates", "Concentrates"],
  ["tinctures", "Tinctures"], ["cbn-sleep", "CBN Sleep"], ["wellness", "Wellness"],
  ["pet-products", "Pet Products"], ["accessories", "Accessories"], ["wholesale", "Wholesale"],
] as const;

const CANNABINOIDS = ["cbd", "cbg", "cbn", "thca", "delta9_hemp", "delta8", "hhc", "mixed", "none"] as const;

const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none";

export function ProductForm() {
  const router = useRouter();
  const [f, setF] = useState({
    title: "", categorySlug: "hemp-flower", cannabinoidType: "cbd", subtype: "",
    shortDescription: "", description: "", batchNumber: "", imageUrl: "",
    sku: "", variantName: "3.5g", price: "", stock: "0",
    labName: "", coaIssueDate: "", retestDate: "",
    delta9: "", totalThc: "", thca: "", cbd: "", cbg: "",
    wholesaleAvailable: false,
  });
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function persist(submit: boolean) {
    setBusy(submit ? "submit" : "save");
    setMsg(null);
    const priceCents = Math.round(parseFloat(f.price || "0") * 100);
    if (!f.title || !f.sku || !priceCents) {
      setMsg({ tone: "err", text: "Title, SKU, and a price are required." });
      setBusy(null);
      return;
    }
    const hasCoa = f.labName && f.coaIssueDate;
    try {
      const res = await fetch("/marketplace/api/vendor/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          categorySlug: f.categorySlug,
          cannabinoidType: f.cannabinoidType,
          subtype: f.subtype || undefined,
          shortDescription: f.shortDescription || undefined,
          description: f.description || undefined,
          batchNumber: f.batchNumber || undefined,
          imageUrl: f.imageUrl || undefined,
          wholesaleAvailable: f.wholesaleAvailable,
          variant: { sku: f.sku, name: f.variantName || "Default", priceCents, stock: parseInt(f.stock || "0", 10) },
          ...(hasCoa && {
            compliance: {
              labName: f.labName,
              coaIssueDate: f.coaIssueDate,
              retestDate: f.retestDate || undefined,
              ...(f.delta9 && { delta9ThcPct: parseFloat(f.delta9) }),
              ...(f.totalThc && { totalThcPct: parseFloat(f.totalThc) }),
              ...(f.thca && { thcaPct: parseFloat(f.thca) }),
              ...(f.cbd && { cbdPct: parseFloat(f.cbd) }),
              ...(f.cbg && { cbgPct: parseFloat(f.cbg) }),
            },
          }),
          submit,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "err", text: body?.error?.message ?? "Save failed." });
        return;
      }
      setMsg({
        tone: "ok",
        text: submit
          ? "Submitted for compliance review — you'll see the decision here and by notification."
          : "Draft saved.",
      });
      router.refresh();
    } catch {
      setMsg({ tone: "err", text: "Network error — nothing was saved." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card-surface rounded-card p-6">
      <h3 className="font-display text-base font-bold text-mist-100">New listing</h3>
      <p className="mt-1 text-xs text-mist-400">
        Drafts are private. Cannabinoid listings need structured COA data before they can enter review.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input aria-label="Product title" placeholder="Product title *" value={f.title} onChange={(e) => set("title", e.target.value)} className={`${inputCls} sm:col-span-2`} />
        <select aria-label="Category" value={f.categorySlug} onChange={(e) => set("categorySlug", e.target.value)} className={inputCls}>
          {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
        </select>
        <select aria-label="Cannabinoid type" value={f.cannabinoidType} onChange={(e) => set("cannabinoidType", e.target.value)} className={inputCls}>
          {CANNABINOIDS.map((c) => <option key={c} value={c}>{c === "none" ? "none (non-cannabinoid)" : c}</option>)}
        </select>
        <input aria-label="Short description" placeholder="Short description (cards & search)" value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={`${inputCls} sm:col-span-2`} />
        <textarea aria-label="Description" placeholder="Full description" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} sm:col-span-2`} />
        <input aria-label="Image URL" placeholder="Image URL (Supabase Storage or approved host)" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} className={`${inputCls} sm:col-span-2`} />
        <input aria-label="SKU" placeholder="SKU *" value={f.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
        <input aria-label="Variant name" placeholder="Variant (e.g. 3.5g)" value={f.variantName} onChange={(e) => set("variantName", e.target.value)} className={inputCls} />
        <input aria-label="Price USD" placeholder="Price USD *" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} className={inputCls} />
        <input aria-label="Stock" placeholder="Stock" inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
        <input aria-label="Batch number" placeholder="Batch/lot number" value={f.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} className={inputCls} />
        <label className="flex items-center gap-2 text-sm text-mist-300">
          <input type="checkbox" checked={f.wholesaleAvailable} onChange={(e) => set("wholesaleAvailable", e.target.checked)} className="h-4 w-4 accent-jade-500" />
          Wholesale available
        </label>
      </div>

      <h4 className="mt-6 text-sm font-semibold text-mist-200">COA (structured — required for cannabinoid listings)</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input aria-label="Lab name" placeholder="Lab name" value={f.labName} onChange={(e) => set("labName", e.target.value)} className={inputCls} />
        <input aria-label="COA issue date" type="date" value={f.coaIssueDate} onChange={(e) => set("coaIssueDate", e.target.value)} className={inputCls} />
        <input aria-label="Retest date" type="date" value={f.retestDate} onChange={(e) => set("retestDate", e.target.value)} className={inputCls} />
        <input aria-label="Delta-9 THC percent" placeholder="Δ9-THC %" inputMode="decimal" value={f.delta9} onChange={(e) => set("delta9", e.target.value)} className={inputCls} />
        <input aria-label="Total THC percent" placeholder="Total THC %" inputMode="decimal" value={f.totalThc} onChange={(e) => set("totalThc", e.target.value)} className={inputCls} />
        <input aria-label="THCA percent" placeholder="THCA %" inputMode="decimal" value={f.thca} onChange={(e) => set("thca", e.target.value)} className={inputCls} />
        <input aria-label="CBD percent" placeholder="CBD %" inputMode="decimal" value={f.cbd} onChange={(e) => set("cbd", e.target.value)} className={inputCls} />
        <input aria-label="CBG percent" placeholder="CBG %" inputMode="decimal" value={f.cbg} onChange={(e) => set("cbg", e.target.value)} className={inputCls} />
      </div>
      <p className="mt-2 text-[11px] text-mist-400">
        COA file upload lands with the storage pipeline — until then structured data is entered here and the review
        team cross-checks it before any badge appears.
      </p>

      {msg && (
        <p className={`mt-4 text-sm ${msg.tone === "ok" ? "text-jade-300" : "text-signal-red"}`} role="status">
          {msg.text}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <Button variant="secondary" disabled={busy !== null} onClick={() => persist(false)}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </Button>
        <Button disabled={busy !== null} onClick={() => persist(true)}>
          {busy === "submit" ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}
