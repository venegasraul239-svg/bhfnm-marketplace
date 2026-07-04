// Vendor products — this vendor's real listings plus the draft form.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { ProductForm } from "./ProductForm";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  live: "ok", approved: "ok", pending_review: "info", changes_requested: "warn",
  draft: "neutral", suspended: "bad", delisted: "bad",
};

export default async function VendorProducts() {
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
    .select("id, title, slug, status, status_note, updated_at, variants:product_variants(price_cents, stock)")
    .eq("vendor_id", vendor.id)
    .order("updated_at", { ascending: false });

  const rows = products ?? [];

  return (
    <DashboardShell title="Products" nav={VENDOR_NAV} active="/vendor-dashboard/products" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        New and edited listings go to compliance review before publishing — status changes are never automatic.
      </p>

      <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-mist-100">
            Your listings <span className="text-sm font-normal text-mist-400">({rows.length})</span>
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="No listings yet" sub="Create your first draft with the form — it stays private until approved." />
          ) : (
            <div className="overflow-x-auto rounded-card border border-ink-700">
              <table className="w-full text-sm">
                <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
                  <tr>
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {rows.map((p) => {
                    const v = (p.variants ?? [])[0];
                    return (
                      <tr key={p.id}>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <ProductForm />
      </div>
    </DashboardShell>
  );
}
