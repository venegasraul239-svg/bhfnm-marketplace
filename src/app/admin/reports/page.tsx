// Admin reports — real aggregates from orders and the ledger. Zeros until
// commerce activity exists; nothing is fabricated.

import { ADMIN_NAV, DashboardShell, StatCards } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminReports() {
  const db = supabaseService();
  if (!db) {
    return (
      <DashboardShell title="Reports" nav={ADMIN_NAV} active="/admin/reports">
        <EmptyState title="Backend not connected" />
      </DashboardShell>
    );
  }

  const [{ data: orders }, { data: ledger }, { count: vendorCount }, { count: liveProducts }, { data: flags }] =
    await Promise.all([
      db.from("orders").select("status, total_cents"),
      db.from("payment_ledger").select("entry_type, amount_cents"),
      db.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("products").select("id", { count: "exact", head: true }).eq("status", "live"),
      db.from("fraud_flags").select("flag_type, severity, created_at, resolved_at").order("created_at", { ascending: false }).limit(50),
    ]);

  const settled = (orders ?? []).filter((o) =>
    ["paid", "accepted", "label_created", "shipped", "delivered", "completed"].includes(o.status)
  );
  const gmv = settled.reduce((s, o) => s + o.total_cents, 0);
  const commission = (ledger ?? [])
    .filter((l) => l.entry_type === "platform_commission")
    .reduce((s, l) => s + Math.abs(l.amount_cents), 0);

  const openFlags = (flags ?? []).filter((f) => !f.resolved_at);

  return (
    <DashboardShell title="Reports" nav={ADMIN_NAV} active="/admin/reports">
      <StatCards
        items={[
          { label: "GMV (settled orders)", value: formatPrice(gmv) },
          { label: "Commission earned", value: formatPrice(commission) },
          { label: "Active vendors", value: String(vendorCount ?? 0) },
          { label: "Live products", value: String(liveProducts ?? 0) },
        ]}
      />
      <p className="mt-4 text-xs text-mist-400">
        CSV exports and time-series analytics ship with the growth milestone; these figures are computed live from
        orders and the payment ledger.
      </p>

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Fraud signals</h2>
      {openFlags.length === 0 ? (
        <EmptyState title="No unresolved fraud flags" sub="Message-moderation hits, tracking anomalies, and risk signals appear here." />
      ) : (
        <ul className="space-y-2">
          {openFlags.map((f, i) => (
            <li key={i} className="card-surface flex items-center justify-between rounded-card px-4 py-3 text-sm">
              <span className="text-mist-200">{f.flag_type.replace(/_/g, " ")}</span>
              <span className="text-xs text-mist-400">severity {f.severity} · {new Date(f.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
