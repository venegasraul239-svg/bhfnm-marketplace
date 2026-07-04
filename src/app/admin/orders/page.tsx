// Admin orders — every real order with payment status. Empty until commerce flows.

import { ADMIN_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  paid: "warn", accepted: "warn", label_created: "info", shipped: "info",
  delivered: "ok", completed: "ok", pending_payment: "neutral",
  payment_processing: "neutral", expired_payment: "neutral",
  cancelled: "bad", refunded: "bad", partially_refunded: "bad",
};

export default async function AdminOrders() {
  const db = supabaseService();
  const { data } = db
    ? await db
        .from("orders")
        .select(
          `id, order_number, status, total_cents, commission_cents, created_at,
           vendor:vendors(brand_name), buyer:profiles(email),
           payment:payments(status, method, invoice_id)`
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: null };

  const rows = data ?? [];

  return (
    <DashboardShell title="Orders" nav={ADMIN_NAV} active="/admin/orders">
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" sub="Orders appear here as soon as buyers create BTCPay invoices." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Total / commission</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {rows.map((o) => {
                const vendor = o.vendor as unknown as { brand_name: string } | null;
                const buyer = o.buyer as unknown as { email: string } | null;
                const payment = (o.payment as unknown as { status: string; method: string | null }[] | null)?.[0];
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-mist-100">{o.order_number}</span>
                      <p className="text-xs text-mist-400">{new Date(o.created_at).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3 text-mist-300">{vendor?.brand_name ?? "—"}</td>
                    <td className="px-4 py-3 text-mist-300">{buyer?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-mist-200">
                      {formatPrice(o.total_cents)} <span className="text-xs text-mist-400">/ {formatPrice(o.commission_cents)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-mist-300">
                      {payment ? `${payment.status}${payment.method ? ` (${payment.method})` : ""}` : "—"}
                    </td>
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
