"use client";

// Guided listing studio: create or edit a draft with live quality scoring,
// a search-result preview, and AI-search readiness checks. Vendors still
// cannot self-publish — submission always routes through admin review.

import { useMemo, useState } from "react";
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

export interface DraftInitial {
  id: string; title: string; categorySlug: string; cannabinoidType: string; subtype: string;
  shortDescription: string; description: string; batchNumber: string; imageUrl: string;
  sku: string; variantName: string; price: string; stock: string;
  labName: string; coaIssueDate: string; retestDate: string;
  delta9: string; totalThc: string; thca: string; cbd: string; cbg: string;
  wholesaleAvailable: boolean;
}

const EMPTY_FORM: Omit<DraftInitial, "id"> = {
  title: "", categorySlug: "hemp-flower", cannabinoidType: "cbd", subtype: "",
  shortDescription: "", description: "", batchNumber: "", imageUrl: "",
  sku: "", variantName: "3.5g", price: "", stock: "0",
  labName: "", coaIssueDate: "", retestDate: "",
  delta9: "", totalThc: "", thca: "", cbd: "", cbg: "",
  wholesaleAvailable: false,
};

const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none";

interface Check {
  key: string;
  label: string;
  pass: boolean;
  tip: string;
}

export function ProductForm({ initial }: { initial?: DraftInitial }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(initial?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState<Omit<DraftInitial, "id">>(initial ? { ...initial } : { ...EMPTY_FORM });
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const isCannabinoid = f.cannabinoidType !== "none";
  const potencyCount = [f.delta9, f.totalThc, f.thca, f.cbd, f.cbg].filter((v) => v.trim()).length;

  // ---- Listing quality checks (SEO + AI-search readiness) ------------------
  const checks: Check[] = useMemo(() => {
    const words = f.title.trim().split(/\s+/).filter(Boolean);
    return [
      {
        key: "title",
        label: "Descriptive title (20–70 chars)",
        pass: f.title.length >= 20 && f.title.length <= 70 && words.length >= 3,
        tip: "Strain + product type + size works best: “Amnesia Haze THCA Flower — Bulk Sativa 3.5g”. This becomes the page title Google shows.",
      },
      {
        key: "meta",
        label: "Short description (50–160 chars)",
        pass: f.shortDescription.length >= 50 && f.shortDescription.length <= 160,
        tip: "One factual sentence — it becomes the meta description in search results and the card text. Lead with what it IS, not hype.",
      },
      {
        key: "body",
        label: "Full description (300+ chars, factual)",
        pass: f.description.replace(/\s+/g, " ").length >= 300,
        tip: "Cover: strain/genetics, aroma and appearance, growing/manufacturing method, who it's for, and how it's tested. AI search engines quote factual, specific sentences — skip superlatives.",
      },
      {
        key: "image",
        label: "Product image",
        pass: Boolean(f.imageUrl),
        tip: "Upload a well-lit photo of the actual product batch — stock photos erode trust and reviews mention it.",
      },
      {
        key: "batch",
        label: "Batch/lot number",
        pass: Boolean(f.batchNumber.trim()),
        tip: "Ties the listing to its COA — required for the Batch Linked badge and makes the product findable by batch search.",
      },
      {
        key: "coa",
        label: isCannabinoid ? "Structured COA (lab, date, 2+ potency values)" : "COA (not required for non-cannabinoid)",
        pass: !isCannabinoid || (Boolean(f.labName.trim()) && Boolean(f.coaIssueDate) && potencyCount >= 2),
        tip: "Verified COA data drives search ranking, the Verified COA badge, and is the #1 buyer trust signal on the marketplace.",
      },
      {
        key: "offer",
        label: "Price and stock set",
        pass: parseFloat(f.price || "0") > 0 && parseInt(f.stock || "0", 10) > 0,
        tip: "In-stock listings get a ranking boost; zero-stock listings can't be purchased.",
      },
    ];
  }, [f, isCannabinoid, potencyCount]);

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

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
          ...(draftId && { id: draftId }),
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
      if (submit) {
        setDraftId(null);
        setF({ ...EMPTY_FORM });
        setMsg({ tone: "ok", text: "Submitted for compliance review — decisions land here and by email." });
        router.push("/vendor-dashboard/products");
      } else {
        setDraftId(body.id ?? draftId);
        setMsg({ tone: "ok", text: "Draft saved — further saves update this same draft." });
      }
      router.refresh();
    } catch {
      setMsg({ tone: "err", text: "Network error — nothing was saved." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card-surface rounded-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-mist-100">
            {draftId ? "Edit listing" : "New listing"}
          </h3>
          <p className="mt-1 text-xs text-mist-400">
            {draftId
              ? "Editing this draft — saves update it in place."
              : "Drafts are private until they pass compliance review."}
          </p>
        </div>
        {draftId && (
          <a href="/marketplace/vendor-dashboard/products" className="text-xs font-semibold text-jade-300 hover:underline">
            + Start new instead
          </a>
        )}
      </div>

      {/* ---- Quality meter ---- */}
      <div className="mt-5 rounded-lg border border-ink-700 bg-ink-900/60 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-mist-300">Listing quality</span>
          <span className={`font-bold ${score >= 85 ? "text-jade-300" : score >= 50 ? "text-amber-glow" : "text-mist-400"}`}>
            {score}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className={`h-full rounded-full transition-all ${score >= 85 ? "bg-jade-500" : score >= 50 ? "bg-amber-glow" : "bg-ink-600"}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li key={c.key} className="group text-xs">
              <span className={c.pass ? "text-jade-300" : "text-mist-400"}>
                {c.pass ? "✓" : "○"} {c.label}
              </span>
              {!c.pass && <p className="ml-4 mt-0.5 hidden leading-relaxed text-mist-500 group-hover:block">{c.tip}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-mist-500">
          Quality feeds search ranking and badge eligibility. Hover an unchecked item for guidance.
        </p>
      </div>

      {/* ---- Fields ---- */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input aria-label="Product title" placeholder="Product title * (strain + type + size)" value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          <p className="mt-1 text-right text-[10px] text-mist-500">{f.title.length}/70</p>
        </div>
        <select aria-label="Category" value={f.categorySlug} onChange={(e) => set("categorySlug", e.target.value)} className={inputCls}>
          {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
        </select>
        <select aria-label="Cannabinoid type" value={f.cannabinoidType} onChange={(e) => set("cannabinoidType", e.target.value)} className={inputCls}>
          {CANNABINOIDS.map((c) => <option key={c} value={c}>{c === "none" ? "none (non-cannabinoid)" : c}</option>)}
        </select>
        <div className="sm:col-span-2">
          <input aria-label="Short description" placeholder="Short description — one factual sentence (becomes your search snippet)" value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} />
          <p className="mt-1 text-right text-[10px] text-mist-500">{f.shortDescription.length}/160</p>
        </div>
        <textarea aria-label="Description" placeholder={"Full description — cover strain & genetics, aroma/appearance, cultivation or manufacturing, intended use, and testing. Specific facts beat marketing language for SEO and AI search."} rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} sm:col-span-2`} />
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-medium text-mist-200 hover:border-jade-500/60">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setMsg(null);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/marketplace/api/vendor/uploads", { method: "POST", body: fd });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setMsg({ tone: "err", text: body?.error?.message ?? "Upload failed." });
                      return;
                    }
                    set("imageUrl", body.url);
                    setMsg({ tone: "ok", text: "Image uploaded." });
                  } catch {
                    setMsg({ tone: "err", text: "Upload failed — check your connection." });
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {uploading ? "Uploading…" : "Upload product image"}
            </label>
            {f.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.imageUrl} alt="Product preview" className="h-10 w-10 rounded-lg border border-ink-600 object-cover" />
            )}
          </div>
          <input aria-label="Image URL" placeholder="…or paste an image URL" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} className={`${inputCls} mt-2`} />
        </div>
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

      {/* ---- Search preview ---- */}
      {(f.title || f.shortDescription) && (
        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-900/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-400">How this looks in Google</p>
          <p className="mt-2 truncate text-[13px] text-mist-500">
            buyhempflowernearme.com › marketplace › product
          </p>
          <p className="truncate text-[17px] leading-snug text-sky-400">
            {f.title || "Product title"} — BHFNM Marketplace
          </p>
          <p className="line-clamp-2 text-[13px] leading-snug text-mist-300">
            {f.shortDescription || f.description.slice(0, 160) || "Your short description appears here."}
          </p>
          <p className="mt-3 text-[10px] leading-relaxed text-mist-500">
            AI answer engines additionally read your structured facts: {f.cannabinoidType !== "none" ? f.cannabinoidType.toUpperCase() : "product"} ·
            {potencyCount > 0 ? ` ${potencyCount} potency value${potencyCount > 1 ? "s" : ""}` : " no potency data yet"} ·
            {f.batchNumber ? ` batch ${f.batchNumber}` : " no batch"} · {f.labName ? f.labName : "no lab named"}
          </p>
        </div>
      )}

      {msg && (
        <p className={`mt-4 text-sm ${msg.tone === "ok" ? "text-jade-300" : "text-signal-red"}`} role="status">
          {msg.text}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button variant="secondary" disabled={busy !== null} onClick={() => persist(false)}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </Button>
        <Button disabled={busy !== null} onClick={() => persist(true)}>
          {busy === "submit" ? "Submitting…" : "Submit for review"}
        </Button>
        {score < 85 && (
          <span className="text-[11px] text-mist-500">Tip: 85%+ quality listings rank noticeably better.</span>
        )}
      </div>
    </div>
  );
}
