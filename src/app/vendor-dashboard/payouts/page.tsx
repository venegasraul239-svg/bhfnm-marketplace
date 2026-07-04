// Vendor payouts — real ledger entries, reserve terms, and payout history.

import { DashboardShell, StatCards, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorPayouts() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Payouts" nav={VENDOR_NAV} active="/vendor-dashboard/payouts">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const [{ data: ledger }, { data: payouts }, { data: reserve }] = await Promise.all([
    db.from("payment_ledger").select("entry_type, amount_cents, memo, created_at")
      .eq("vendor_id", vendor.id).order("created_at", { ascending: false }).limit(100),
    db.from("payouts").select("id, amount_cents, status, txid, created_at")
      .eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
    db.from("vendor_reserves").select("reserve_pct, rolling_days").eq("vendor_id", vendor.id).maybeSingle(),
  ]);

  const sum = (type: string) =>
    (ledger ?? []).filter((l) => l.entry_type === type).reduce((s, l) => s + l.amount_cents, 0);
  const earnings = sum("vendor_earnings");
  const reserved = sum("reserve_hold") - Math.abs(sum("reserve_release"));
  const paidOut = Math.abs(sum("payout"));

  return (
    <DashboardShell title="Payouts" nav={VENDOR_NAV} active="/vendor-dashboard/payouts" badge={vendor.brand_name}>
      <StatCards
        items={[
          { label: "Earnings (net of reserve)", value: formatPrice(earnings) },
          { label: "In rolling reserve", value: formatPrice(Math.max(0, reserved)) },
          { label: "Paid out", value: formatPrice(paidOut) },
          {
            label: "Reserve terms",
            value: reserve ? `${Math.round(Number(reserve.reserve_pct) * 100)}% / ${reserve.rolling_days}d` : "—",
          },
        ]}
      />
      <p className="mt-4 text-xs text-mist-400">
        Payouts are BTC/Lightning to your verified wallet, processed from the admin queue after delivery and dispute
        windows clear. Reserves release on your rolling schedule and shrink as your track record grows.
      </p>

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Payout history</h2>
      {(payouts ?? []).length === 0 ? (
        <EmptyState title="No payouts yet" sub="Completed orders accrue here and enter the payout queue on schedule." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Transaction</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {(payouts ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-mist-300">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-mist-200">{formatPrice(p.amount_cents)}</td>
                  <td className="px-4 py-3"><StatusPill tone={p.status === "sent" ? "ok" : p.status === "held" || p.status === "failed" ? "bad" : "info"}>{p.status}</StatusPill></td>
                  <td className="px-4 py-3 font-mono text-xs text-mist-400">{p.txid ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Ledger</h2>
      {(ledger ?? []).length === 0 ? (
        <EmptyState title="No ledger entries yet" sub="Every settled payment posts commission, earnings, and reserve entries here." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Memo</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {(ledger ?? []).map((l, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-mist-300">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-mist-300">{l.entry_type.replace(/_/g, " ")}</td>
                  <td className={`px-4 py-3 ${l.amount_cents < 0 ? "text-signal-red" : "text-mist-200"}`}>{formatPrice(l.amount_cents)}</td>
                  <td className="px-4 py-3 text-xs text-mist-400">{l.memo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
