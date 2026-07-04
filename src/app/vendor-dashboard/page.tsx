// Vendor overview — every number derives from this vendor's real records.
// Zero activity renders as zeros and guidance, never sample data.

import Link from "next/link";
import { DashboardShell, StatCards, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOverview() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Vendor dashboard" nav={VENDOR_NAV} active="/vendor-dashboard">
        <EmptyState
          title="No approved store on this account"
          sub="The vendor dashboard activates once your application is approved and your storefront is provisioned."
          action={
            <Link href="/vendors/apply/status" className="text-sm font-semibold text-jade-300 underline">
              Check application status
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: recentOrders }, { data: toShip }, { data: earnings }, { count: openDisputes }, { data: attention }] =
    await Promise.all([
      db.from("orders").select("total_cents, status").eq("vendor_id", vendor.id)
        .in("status", ["paid", "accepted", "label_created", "shipped", "delivered", "completed"])
        .gte("created_at", thirtyDaysAgo),
      db.from("orders").select("id, order_number, created_at, total_cents").eq("vendor_id", vendor.id)
        .in("status", ["paid", "accepted"]).order("created_at", { ascending: true }),
      db.from("payment_ledger").select("amount_cents").eq("vendor_id", vendor.id).eq("entry_type", "vendor_earnings"),
      db.from("disputes").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id)
        .not("status", "in", "(resolved,closed)"),
      db.from("products").select("id, title, status, status_note").eq("vendor_id", vendor.id)
        .in("status", ["changes_requested", "pending_review", "draft"]).order("updated_at", { ascending: false }).limit(10),
    ]);

  const sales30 = (recentOrders ?? []).reduce((sum, o) => sum + o.total_cents, 0);
  const eligible = (earnings ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const shipQueue = toShip ?? [];
  const drafts = attention ?? [];

  return (
    <DashboardShell title="Vendor dashboard" nav={VENDOR_NAV} active="/vendor-dashboard" badge={vendor.brand_name}>
      <StatCards
        items={[
          { label: "Sales (30d)", value: formatPrice(sales30) },
          { label: "Orders to ship", value: String(shipQueue.length), tone: shipQueue.length ? "warn" : "ok" },
          { label: "Earnings accrued", value: formatPrice(eligible) },
          { label: "Open disputes", value: String(openDisputes ?? 0), tone: openDisputes ? "bad" : "ok" },
        ]}
      />

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Orders awaiting fulfillment</h2>
      {shipQueue.length === 0 ? (
        <EmptyState title="Nothing to ship" sub="Paid orders appear here the moment payment settles." />
      ) : (
        <ul className="space-y-2">
          {shipQueue.map((o) => (
            <li key={o.id} className="card-surface flex items-center justify-between rounded-card px-4 py-3 text-sm">
              <span className="font-medium text-mist-100">{o.order_number}</span>
              <span className="text-mist-400">{new Date(o.created_at).toLocaleDateString()}</span>
              <span className="text-mist-200">{formatPrice(o.total_cents)}</span>
              <StatusPill tone="warn">Generate label</StatusPill>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Listings needing attention</h2>
      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts or review notes"
          sub="Create a listing to start the review process — nothing goes public without approval."
          action={
            <Link href="/vendor-dashboard/products" className="text-sm font-semibold text-jade-300 underline">
              Manage products
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {drafts.map((p) => (
            <li key={p.id} className="card-surface flex items-center justify-between gap-4 rounded-card px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-mist-100">{p.title}</span>
                {p.status_note && <span className="ml-2 truncate text-xs text-amber-glow">{p.status_note}</span>}
              </span>
              <StatusPill tone={p.status === "changes_requested" ? "warn" : p.status === "pending_review" ? "info" : "neutral"}>
                {p.status.replace(/_/g, " ")}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
