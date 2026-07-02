import { ADMIN_NAV, DashboardShell, QueueTable, StatCards } from "@/components/DashboardShell";
import { StatusPill } from "@/components/ui";

export default function AdminOverview() {
  return (
    <DashboardShell title="Marketplace admin" nav={ADMIN_NAV} active="/admin" badge="Full audit logging">
      <StatCards
        items={[
          { label: "Vendor applications", value: "6 pending", tone: "warn" },
          { label: "Products awaiting review", value: "14", tone: "warn" },
          { label: "COAs expiring ≤30d", value: "5", tone: "warn" },
          { label: "Open disputes", value: "2", tone: "bad" },
        ]}
      />
      <div className="mt-6">
        <StatCards
          items={[
            { label: "GMV (30d)", value: "$41,260" },
            { label: "Commission (30d)", value: "$4,951" },
            { label: "Payout queue", value: "$12,380" },
            { label: "Active fraud flags", value: "3", tone: "bad" },
          ]}
        />
      </div>
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Risk alerts</h2>
      <QueueTable
        headers={["Severity", "Signal", "Subject", "Detail", "Age"]}
        rows={[
          [<StatusPill key="s" tone="bad">High</StatusPill>, "Off-platform payment ask", "Vendor: GreenLeaf Direct (applicant)", "Message flagged: “can send BTC directly to save fees”", "2h"],
          [<StatusPill key="s" tone="warn">Med</StatusPill>, "Tracking anomaly", "Vendor: Peak Extracts", "3 labels created, no acceptance scans in 5 days", "1d"],
          [<StatusPill key="s" tone="warn">Med</StatusPill>, "Review pattern", "Product: Citrus Burst Gummies", "4 five-star reviews from adjacent signup cohort", "2d"],
        ]}
      />
    </DashboardShell>
  );
}
