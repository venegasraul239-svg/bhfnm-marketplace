// Admin product review — the real pending_review queue. Nothing publishes
// without passing through here.

import { DashboardShell, ADMIN_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { ReviewPanel } from "./ReviewPanel";

export const dynamic = "force-dynamic";

interface QueueRow {
  id: string;
  title: string;
  cannabinoid_type: string;
  batch_number: string | null;
  updated_at: string;
  vendor: { brand_name: string; slug: string } | null;
  category: { name: string } | null;
  variants: { price_cents: number; stock: number }[];
  compliance: {
    lab_name: string; coa_issue_date: string; batch_number: string;
    delta9_thc_pct: number | null; total_thc_pct: number | null; status: string;
  }[];
}

export default async function AdminProducts() {
  const db = supabaseService();
  const { data } = db
    ? await db
        .from("products")
        .select(
          `id, title, cannabinoid_type, batch_number, updated_at,
           vendor:vendors(brand_name, slug), category:categories(name),
           variants:product_variants(price_cents, stock),
           compliance:compliance_records(lab_name, coa_issue_date, batch_number, delta9_thc_pct, total_thc_pct, status)`
        )
        .eq("status", "pending_review")
        .order("updated_at", { ascending: true })
    : { data: null };

  const queue = (data ?? []) as unknown as QueueRow[];

  return (
    <DashboardShell title="Product review" nav={ADMIN_NAV} active="/admin/products">
      <p className="mb-6 text-sm text-mist-400">
        Nothing publishes without passing this queue. Check required fields, structured COA data vs the batch,
        cannabinoid values vs category rules, and jurisdiction sanity before approving.
      </p>

      {queue.length === 0 ? (
        <EmptyState title="Review queue is clear" sub="Vendor submissions land here for compliance review." />
      ) : (
        <div className="space-y-4">
          {queue.map((p) => {
            const v = p.variants[0];
            const c = p.compliance[0];
            return (
              <div key={p.id} className="card-surface rounded-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-mist-100">{p.title}</p>
                    <p className="mt-0.5 text-xs text-mist-400">
                      {p.vendor?.brand_name} · {p.category?.name} · {p.cannabinoid_type} ·{" "}
                      {v ? `${formatPrice(v.price_cents)} / stock ${v.stock}` : "no variant"} · submitted{" "}
                      {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusPill tone="info">pending review</StatusPill>
                </div>

                <div className="mt-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3 text-xs">
                  {c ? (
                    <p className="text-mist-300">
                      COA: {c.lab_name} · issued {c.coa_issue_date} · batch {c.batch_number}
                      {c.batch_number !== p.batch_number && (
                        <span className="ml-1 font-semibold text-signal-red">≠ listing batch {p.batch_number ?? "—"}</span>
                      )}
                      {" · "}Δ9 {c.delta9_thc_pct ?? "—"}% · total THC {c.total_thc_pct ?? "—"}% ·{" "}
                      <span className="uppercase">{c.status}</span>
                    </p>
                  ) : (
                    <p className={p.cannabinoid_type === "none" ? "text-mist-400" : "font-semibold text-signal-red"}>
                      {p.cannabinoid_type === "none"
                        ? "Non-cannabinoid listing — no COA required."
                        : "No compliance record attached — request changes."}
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-ink-700 pt-4">
                  <ReviewPanel productId={p.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
