import { ADMIN_NAV, DashboardShell, QueueTable, StatCards } from "@/components/DashboardShell";
import { Button } from "@/components/ui";

export default function AdminReports() {
  return (
    <DashboardShell title="Analytics & reports" nav={ADMIN_NAV} active="/admin/reports">
      <StatCards
        items={[
          { label: "GMV (30d)", value: "$41,260" },
          { label: "Take rate (effective)", value: "12.0%" },
          { label: "Wholesale GMV share", value: "31%" },
          { label: "Search → PDP CTR", value: "18.4%" },
        ]}
      />
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-mist-100">Exports</h2>
      <QueueTable
        headers={["Report", "Contents", ""]}
        rows={[
          ["Revenue & commission", "Orders, commission snapshots, ledger entries by vendor/category", <Button key="a" variant="secondary" size="sm">Export CSV</Button>],
          ["Payout history", "All payouts with txids, reserves, holds", <Button key="a" variant="secondary" size="sm">Export CSV</Button>],
          ["Compliance status", "All COA records, verification states, expirations", <Button key="a" variant="secondary" size="sm">Export CSV</Button>],
          ["Dispute evidence bundle", "Per-dispute evidence archive", <Button key="a" variant="secondary" size="sm">Export ZIP</Button>],
          ["Audit log", "Every admin/system action with before/after state", <Button key="a" variant="secondary" size="sm">Export CSV</Button>],
          ["Search analytics", "Top queries, zero-result queries, facet usage", <Button key="a" variant="secondary" size="sm">Export CSV</Button>],
        ]}
      />
    </DashboardShell>
  );
}
