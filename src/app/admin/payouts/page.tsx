// Admin payouts — real queue and per-vendor accruals. Manual BTC send at
// launch: approve here, transact from the platform wallet, record the txid.

import { ADMIN_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPayouts() {
  const db = supabaseService();

  const [{ data: payouts }, { data: ledger }] = db
    ? await Promise.all([
        db.from("payouts")
          .select("id, amount_cents, status, wallet_address, txid, created_at, vendor:vendors(brand_name)")
          .order("created_at", { ascending: false }),
        db.from("payment_ledger").select("vendor_id, entry_type, amount_cents, vendor:vendors(brand_name)"),
      ])
    : [{ data: null }, { data: null }];

  const accruals = new Map<string, { brand: string; earnings: number; reserve: number }>();
  for (const l of ledger ?? []) {
    const vendor = l.vendor as unknown as { brand_name: string } | null;
    if (!l.vendor_id || !vendor) continue;
    const cur = accruals.get(l.vendor_id) ?? { brand: vendor.brand_name, earnings: 0, reserve: 0 };
    if (l.entry_type === "vendor_earnings") cur.earnings += l.amount_cents;
    if (l.entry_type === "reserve_hold") cur.reserve += l.amount_cents;
    if (l.entry_type === "reserve_release") cur.reserve -= Math.abs(l.amount_cents);
    if (l.entry_type === "payout") cur.earnings -= Math.abs(l.amount_cents);
    accruals.set(l.vendor_id, cur);
  }

  return (
    <DashboardShell title="Payouts" nav={ADMIN_NAV} active="/admin/payouts">
      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Vendor accruals</h2>
      {accruals.size === 0 ? (
        <EmptyState title="No vendor earnings yet" sub="Settled orders post earnings and reserve entries per vendor." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Available earnings</th><th className="px-4 py-3">In reserve</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {[...accruals.values()].map((a) => (
                <tr key={a.brand}>
                  <td className="px-4 py-3 font-medium text-mist-100">{a.brand}</td>
                  <td className="px-4 py-3 text-mist-200">{formatPrice(a.earnings)}</td>
                  <td className="px-4 py-3 text-mist-300">{formatPrice(Math.max(0, a.reserve))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Payout queue & history</h2>
      {(payouts ?? []).length === 0 ? (
        <EmptyState
          title="No payouts queued"
          sub="Eligible balances enter this queue on each vendor's reserve schedule. Approve, send BTC from the platform wallet, and record the txid."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Wallet</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Txid</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {(payouts ?? []).map((p) => {
                const vendor = p.vendor as unknown as { brand_name: string } | null;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-mist-100">{vendor?.brand_name ?? "—"}</td>
                    <td className="px-4 py-3 text-mist-200">{formatPrice(p.amount_cents)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-mist-400">{p.wallet_address}</td>
                    <td className="px-4 py-3"><StatusPill tone={p.status === "sent" ? "ok" : p.status === "held" || p.status === "failed" ? "bad" : "info"}>{p.status}</StatusPill></td>
                    <td className="px-4 py-3 font-mono text-xs text-mist-400">{p.txid ?? "—"}</td>
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
