import { ADMIN_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminVendors() {
  return (
    <DashboardShell title="Vendor review" nav={ADMIN_NAV} active="/admin/vendors">
      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Application queue</h2>
      <QueueTable
        headers={["Applicant", "Type", "Docs", "Wallet verified", "Risk", "Status", "Action"]}
        rows={[
          ["Green Door Farms (OR)", "Hemp farm", "5/6 accepted", "Pending", <StatusPill key="r" tone="ok">Low</StatusPill>, <StatusPill key="s" tone="warn">Under review</StatusPill>, <Button key="a" size="sm">Review</Button>],
          ["Coastal Extracts LLC (FL)", "Manufacturer", "6/6 accepted", "Yes", <StatusPill key="r" tone="ok">Low</StatusPill>, <StatusPill key="s" tone="warn">Under review</StatusPill>, <Button key="a" size="sm">Review</Button>],
          ["GreenLeaf Direct (??)", "Reseller", "2/6 — ID mismatch", "No", <StatusPill key="r" tone="bad">High</StatusPill>, <StatusPill key="s" tone="bad">Info requested</StatusPill>, <Button key="a" variant="danger" size="sm">Review flags</Button>],
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Active vendors</h2>
      <QueueTable
        headers={["Vendor", "Health", "Reserve", "Commission", "Open disputes", "Controls"]}
        rows={[
          ["Blue Ridge Hemp Co.", <StatusPill key="h" tone="ok">Excellent</StatusPill>, "5% / 14d (reduced)", "12%", "0", <span key="c" className="flex gap-2"><Button variant="ghost" size="sm">Adjust</Button></span>],
          ["Solstice Labs", <StatusPill key="h" tone="ok">Good</StatusPill>, "10% / 21d", "12%", "0", <span key="c" className="flex gap-2"><Button variant="ghost" size="sm">Adjust</Button></span>],
          ["High Plains Processing", <StatusPill key="h" tone="warn">Watch</StatusPill>, "15% / 30d", "11% (wholesale)", "1", <span key="c" className="flex gap-2"><Button variant="ghost" size="sm">Adjust</Button><Button variant="danger" size="sm">Hold payouts</Button></span>],
        ]}
      />
      <p className="mt-4 text-xs text-mist-400">Every decision here writes to the audit log with actor, before/after state, and reason code.</p>
    </DashboardShell>
  );
}
