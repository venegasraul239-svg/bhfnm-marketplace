// Vendor orders — this vendor's real orders only.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  paid: "warn", accepted: "warn", label_created: "info", shipped: "info",
  delivered: "ok", completed: "ok", pending_payment: "neutral",
  payment_processing: "neutral", expired_payment: "neutral",
  cancelled: "bad", refunded: "bad", partially_refunded: "bad",
};

export default async function VendorOrders() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Orders" nav={VENDOR_NAV} active="/vendor-dashboard/orders">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const { data: orders } = await db
    .from("orders")
    .select("id, order_number, status, total_cents, created_at, destination, items:order_items(title, quantity)")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = orders ?? [];

  return (
    <DashboardShell title="Orders" nav={VENDOR_NAV} active="/vendor-dashboard/orders" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        Fulfillment requires a platform-generated label with a carrier acceptance scan — label generation ships with
        the carrier integration milestone and is not yet available in beta.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" sub="Orders appear here the moment a buyer's Bitcoin payment settles." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {rows.map((o) => {
                const dest = o.destination as { country?: string; region?: string } | null;
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-mist-100">{o.order_number}</span>
                      <p className="text-xs text-mist-400">{new Date(o.created_at).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3 text-mist-300">
                      {(o.items ?? []).map((i) => `${i.quantity}× ${i.title}`).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-mist-300">{dest ? `${dest.region ?? ""} ${dest.country ?? ""}` : "—"}</td>
                    <td className="px-4 py-3 text-mist-200">{formatPrice(o.total_cents)}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={TONE[o.status] ?? "neutral"}>{o.status.replace(/_/g, " ")}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
