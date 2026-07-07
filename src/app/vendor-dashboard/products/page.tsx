// Vendor products — this vendor's real listings plus the guided listing
// studio. ?edit=<id> loads an editable draft into the form.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { ProductForm, type DraftInitial } from "./ProductForm";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  live: "ok", approved: "ok", pending_review: "info", changes_requested: "warn",
  draft: "neutral", suspended: "bad", delisted: "bad",
};

const EDITABLE = new Set(["draft", "changes_requested"]);

export default async function VendorProducts({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Products" nav={VENDOR_NAV} active="/vendor-dashboard/products">
        <EmptyState title="No approved store on this account" sub="Products unlock once your application is approved." />
      </DashboardShell>
    );
  }

  const { data: products } = await db
    .from("products")
    .select(
      `id, title, slug, status, status_note, updated_at, subtype, short_description,
       description, batch_number, cannabinoid_type, wholesale_available,
       category:categories(slug),
       variants:product_variants(sku, name, price_cents, stock),
       images:product_images(url),
       compliance:compliance_records(lab_name, coa_issue_date, retest_date,
         delta9_thc_pct, total_thc_pct, thca_pct, cbd_pct, cbg_pct)`
    )
    .eq("vendor_id", vendor.id)
    .order("updated_at", { ascending: false });

  const rows = products ?? [];

  // Hydrate the form when editing one of this vendor's editable drafts.
  let initial: DraftInitial | undefined;
  if (edit) {
    const p = rows.find((r) => r.id === edit && EDITABLE.has(r.status));
    if (p) {
      const v = (p.variants ?? [])[0];
      const c = (p.compliance ?? [])[0];
      const cat = p.category as unknown as { slug: string } | null;
      const num = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));
      initial = {
        id: p.id,
        title: p.title ?? "",
        categorySlug: cat?.slug ?? "hemp-flower",
        cannabinoidType: p.cannabinoid_type ?? "cbd",
        subtype: p.subtype ?? "",
        shortDescription: p.short_description ?? "",
        description: p.description ?? "",
        batchNumber: p.batch_number ?? "",
        imageUrl: (p.images ?? [])[0]?.url ?? "",
        sku: v?.sku ?? "",
        variantName: v?.name ?? "3.5g",
        price: v ? (v.price_cents / 100).toFixed(2) : "",
        stock: v ? String(v.stock) : "0",
        labName: c?.lab_name ?? "",
        coaIssueDate: c?.coa_issue_date ?? "",
        retestDate: c?.retest_date ?? "",
        delta9: num(c?.delta9_thc_pct),
        totalThc: num(c?.total_thc_pct),
        thca: num(c?.thca_pct),
        cbd: num(c?.cbd_pct),
        cbg: num(c?.cbg_pct),
        wholesaleAvailable: Boolean(p.wholesale_available),
      };
    }
  }

  return (
    <DashboardShell title="Products" nav={VENDOR_NAV} active="/vendor-dashboard/products" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        New and edited listings go to compliance review before publishing — status changes are never automatic.
      </p>

      {edit && !initial && (
        <p className="mb-4 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-sm text-amber-glow">
          That listing can&apos;t be edited here — only drafts and changes-requested listings are
          editable. Live listings need a change request via the review team.
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_460px]">
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-mist-100">
            Your listings <span className="text-sm font-normal text-mist-400">({rows.length})</span>
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="No listings yet" sub="Create your first draft with the studio — it stays private until approved." />
          ) : (
            <div className="overflow-x-auto rounded-card border border-ink-700">
              <table className="w-full text-sm">
                <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
                  <tr>
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {rows.map((p) => {
                    const v = (p.variants ?? [])[0];
                    return (
                      <tr key={p.id} className={edit === p.id ? "bg-jade-500/5" : undefined}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-mist-100">{p.title}</span>
                          {p.status === "live" && (
                            <a href={`/marketplace/product/${p.slug}`} className="ml-2 text-xs text-jade-300 hover:underline">view</a>
                          )}
                          {p.status_note && <p className="mt-0.5 text-xs text-amber-glow">{p.status_note}</p>}
                        </td>
                        <td className="px-4 py-3 text-mist-200">{v ? formatPrice(v.price_cents) : "—"}</td>
                        <td className="px-4 py-3 text-mist-300">{v?.stock ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={TONE[p.status] ?? "neutral"}>{p.status.replace(/_/g, " ")}</StatusPill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {EDITABLE.has(p.status) && (
                            <a
                              href={`/marketplace/vendor-dashboard/products?edit=${p.id}`}
                              className="text-xs font-semibold text-jade-300 hover:underline"
                            >
                              Edit
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <ProductForm key={initial?.id ?? "new"} initial={initial} />
      </div>
    </DashboardShell>
  );
}
