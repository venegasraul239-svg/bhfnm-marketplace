import { DashboardShell, QueueTable, StatCards, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorPayouts() {
  return (
    <DashboardShell title="Payouts" nav={VENDOR_NAV} active="/vendor-dashboard/payouts">
      <StatCards
        items={[
          { label: "Eligible now", value: "$1,940" },
          { label: "In rolling reserve (15% / 30d)", value: "$486" },
          { label: "Pending delivery/dispute", value: "$733" },
          { label: "Lifetime paid out", value: "$28,410" },
        ]}
      />
      <p className="mt-6 text-sm text-mist-400">
        Payouts release to your verified BTC/LN wallet after delivery confirmation and the 48-hour dispute window,
        minus the rolling reserve. Reserves shrink automatically as your performance history builds.
      </p>
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-mist-100">History</h2>
      <QueueTable
        headers={["Date", "Amount", "Method", "Status", "TxID"]}
        rows={[
          ["Jun 28, 2026", "$1,205.00", "BTC on-chain", <StatusPill key="s" tone="ok">Sent</StatusPill>, "9d1e…44a0"],
          ["Jun 14, 2026", "$980.00", "Lightning", <StatusPill key="s" tone="ok">Sent</StatusPill>, "lnbc…"],
          ["May 31, 2026", "$1,730.00", "BTC on-chain", <StatusPill key="s" tone="ok">Sent</StatusPill>, "310b…c7f2"],
        ]}
      />
      <div className="mt-4"><Button variant="secondary" size="sm">Export CSV</Button></div>
    </DashboardShell>
  );
}
