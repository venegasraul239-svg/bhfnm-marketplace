"use client";

// Three-step import wizard: upload CSV → map source categories to marketplace
// taxonomy (+ cannabinoid type) and prune rows → import as drafts.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import type { ImportedRow } from "@/lib/import";

const CATEGORIES = [
  ["hemp-flower", "Hemp Flower"], ["cbd-flower", "CBD Flower"], ["cbg-flower", "CBG Flower"],
  ["thca-flower", "THCA Flower"], ["pre-rolls", "Hemp Pre-Rolls"], ["thc-drinks", "THC Drinks"],
  ["gummies", "Gummies"], ["edibles", "Edibles"], ["vapes", "Vapes"], ["concentrates", "Concentrates"],
  ["tinctures", "Tinctures"], ["cbn-sleep", "CBN Sleep"], ["wellness", "Wellness"],
  ["pet-products", "Pet Products"], ["accessories", "Accessories"], ["wholesale", "Wholesale"],
] as const;

const CANNABINOIDS = ["cbd", "cbg", "cbn", "thca", "delta9_hemp", "delta8", "hhc", "mixed", "none"] as const;

interface Mapping {
  categorySlug: string;
  cannabinoidType: string;
}

const inputCls =
  "rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-mist-100 focus:border-jade-500 focus:outline-none";

export function ImportWizard() {
  const [rows, setRows] = useState<ImportedRow[] | null>(null);
  const [format, setFormat] = useState<string>("");
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMapping] = useState<Record<string, Mapping>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"parse" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; failed: number; results: { title: string; ok: boolean; reason?: string }[] } | null>(null);

  const categories = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.sourceCategory))].sort() : []),
    [rows]
  );
  const included = rows?.filter((r) => !excluded.has(r.sourceHandle)) ?? [];
  const unmapped = categories.filter(
    (c) => included.some((r) => r.sourceCategory === c) && !mapping[c]?.categorySlug
  );

  async function parseFile(file: File) {
    setBusy("parse");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/marketplace/api/vendor/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not read that file.");
        return;
      }
      setRows(body.rows);
      setFormat(body.format);
      setTruncated(Boolean(body.truncated));
    } catch {
      setError("Upload failed — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!rows) return;
    setBusy("commit");
    setError(null);
    try {
      const payload = included.map((r) => ({
        title: r.title.slice(0, 160),
        description: r.description || undefined,
        shortDescription: r.shortDescription || undefined,
        categorySlug: mapping[r.sourceCategory].categorySlug,
        cannabinoidType: mapping[r.sourceCategory].cannabinoidType,
        sku: r.sku.slice(0, 60),
        variantName: r.variantName.slice(0, 60) || "Default",
        priceCents: r.priceCents,
        stock: r.stock,
        imageUrl: r.imageUrl || undefined,
        tags: r.tags.slice(0, 30),
        sourceCategory: r.sourceCategory.slice(0, 120),
        sourceHandle: r.sourceHandle.slice(0, 160),
      }));
      const res = await fetch("/marketplace/api/vendor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Import failed — nothing was created.");
        return;
      }
      setDone(body);
    } catch {
      setError("Network error — import not completed.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="card-surface rounded-card p-6">
        <h2 className="font-display text-lg font-bold text-mist-100">Import complete</h2>
        <p className="mt-2 text-sm text-mist-300">
          {done.created} draft{done.created === 1 ? "" : "s"} created{done.failed > 0 ? `, ${done.failed} failed` : ""}.
          Each draft needs its structured COA data added in the listing studio before it can be
          submitted for review — imports never publish automatically.
        </p>
        {done.failed > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-signal-red">
            {done.results.filter((r) => !r.ok).map((r) => (
              <li key={r.title}>✗ {r.title} — {r.reason}</li>
            ))}
          </ul>
        )}
        <div className="mt-5">
          <Button href="/vendor-dashboard/products">Open your drafts</Button>
        </div>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="card-surface rounded-card p-6">
        <h2 className="font-display text-lg font-bold text-mist-100">Upload your export</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-mist-400">
          <li>• <strong className="text-mist-200">Shopify:</strong> Admin → Products → Export → CSV (plain CSV file)</li>
          <li>• <strong className="text-mist-200">WooCommerce:</strong> Products → All Products → Export → CSV</li>
        </ul>
        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm font-medium text-mist-200 hover:border-jade-500/60">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
              e.target.value = "";
            }}
          />
          {busy === "parse" ? "Reading…" : "Choose CSV file"}
        </label>
        {error && <p className="mt-3 text-sm text-signal-red">{error}</p>}
        <p className="mt-4 text-[11px] leading-relaxed text-mist-500">
          The format is detected automatically. Nothing is created at this step — you&apos;ll map your
          store&apos;s categories to marketplace categories first, and everything imports as private drafts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-surface rounded-card p-6">
        <h2 className="font-display text-lg font-bold text-mist-100">
          Map your categories <span className="text-sm font-normal text-mist-400">({format} export · {rows.length} products{truncated ? " · truncated to 200" : ""})</span>
        </h2>
        <p className="mt-1 text-sm text-mist-400">
          Your store&apos;s categories don&apos;t match marketplace taxonomy 1:1 — assign each one a
          marketplace category and cannabinoid type. Original categories and tags are preserved on
          each listing as searchable facts.
        </p>
        <div className="mt-4 space-y-2">
          {categories.map((c) => (
            <div key={c} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/50 px-3 py-2">
              <span className="min-w-32 flex-1 truncate text-sm text-mist-100" title={c}>{c}</span>
              <select
                aria-label={`Marketplace category for ${c}`}
                value={mapping[c]?.categorySlug ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [c]: { categorySlug: e.target.value, cannabinoidType: m[c]?.cannabinoidType ?? "cbd" } }))}
                className={inputCls}
              >
                <option value="">Map to…</option>
                {CATEGORIES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
              </select>
              <select
                aria-label={`Cannabinoid type for ${c}`}
                value={mapping[c]?.cannabinoidType ?? "cbd"}
                onChange={(e) => setMapping((m) => ({ ...m, [c]: { categorySlug: m[c]?.categorySlug ?? "", cannabinoidType: e.target.value } }))}
                className={inputCls}
              >
                {CANNABINOIDS.map((x) => <option key={x} value={x}>{x === "none" ? "none (non-cannabinoid)" : x}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface rounded-card p-6">
        <h2 className="font-display text-lg font-bold text-mist-100">
          Review rows <span className="text-sm font-normal text-mist-400">({included.length} selected)</span>
        </h2>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-ink-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-900 text-left uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Source category</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {rows.map((r) => (
                <tr key={r.sourceHandle} className={excluded.has(r.sourceHandle) ? "opacity-40" : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Include ${r.title}`}
                      checked={!excluded.has(r.sourceHandle)}
                      onChange={(e) =>
                        setExcluded((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.delete(r.sourceHandle);
                          else next.add(r.sourceHandle);
                          return next;
                        })
                      }
                      className="h-3.5 w-3.5 accent-jade-500"
                    />
                  </td>
                  <td className="max-w-60 truncate px-3 py-2 text-mist-100" title={r.title}>
                    {r.title}
                    {r.extraVariants > 0 && (
                      <span className="ml-1 text-amber-glow" title="Only the first variant imports in this flow">
                        +{r.extraVariants} variants
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-mist-300">{r.sourceCategory}</td>
                  <td className="px-3 py-2 text-mist-300">${(r.priceCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 text-mist-300">{r.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="mt-3 text-sm text-signal-red">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button
            disabled={busy !== null || included.length === 0 || unmapped.length > 0}
            onClick={commit}
          >
            {busy === "commit" ? "Importing…" : `Import ${included.length} as drafts`}
          </Button>
          {unmapped.length > 0 && (
            <span className="text-xs text-amber-glow">Map remaining: {unmapped.join(", ")}</span>
          )}
          <button onClick={() => { setRows(null); setMapping({}); setExcluded(new Set()); setError(null); }} className="text-xs font-semibold text-mist-400 hover:text-mist-200">
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
