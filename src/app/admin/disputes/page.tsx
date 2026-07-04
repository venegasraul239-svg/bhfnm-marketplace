// Admin disputes — real disputes only; decision tooling ships with the
// dispute milestone (fulfillment must exist before delivery disputes can).

import { ADMIN_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDisputes() {
  const db = supabaseService();
  const { data } = db
    ? await db
        .from("disputes")
        .select(
          `id, reason, description, status, refund_amount_cents, created_at,
           order:orders(order_number, total_cents), vendor:vendors(brand_name), buyer:profiles!disputes_buyer_id_fkey(email)`
        )
        .order("created_at", { ascending: false })
    : { data: null };

  const rows = data ?? [];

  return (
    <DashboardShell title="Disputes" nav={ADMIN_NAV} active="/admin/disputes">
      <p className="mb-6 text-sm text-mist-400">
        Buyers get 48 hours post-delivery to open a dispute; sellers get 48 hours to respond; admins decide.
        Decision controls (refunds, returns, penalties) ship with the fulfillment milestone.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No disputes" sub="Opened disputes appear here with order, evidence, and party context." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const order = d.order as unknown as { order_number: string; total_cents: number } | null;
            const vendor = d.vendor as unknown as { brand_name: string } | null;
            const buyer = d.buyer as unknown as { email: string } | null;
            return (
              <li key={d.id} className="card-surface rounded-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-mist-100">
                    {order?.order_number} · {order ? formatPrice(order.total_cents) : ""}
                  </p>
                  <StatusPill tone={["resolved", "closed"].includes(d.status) ? "ok" : "warn"}>
                    {d.status.replace(/_/g, " ")}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs text-mist-400">
                  {buyer?.email} vs {vendor?.brand_name} · {d.reason.replace(/_/g, " ")} ·{" "}
                  {new Date(d.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-mist-300">{d.description}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
