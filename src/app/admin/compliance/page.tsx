import { ADMIN_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminCompliance() {
  return (
    <DashboardShell title="Compliance review" nav={ADMIN_NAV} active="/admin/compliance">
      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">COA verification queue</h2>
      <QueueTable
        headers={["Batch", "Product", "Lab", "File hash", "Structured data", "Action"]}
        rows={[
          ["MM-2606", "Mountain Mist Pre-Rolls", "Foothills Analytical", "ok · sha256 match", <StatusPill key="d" tone="ok">Complete</StatusPill>, <span key="a" className="flex gap-2"><Button size="sm">Verify</Button><Button variant="secondary" size="sm">Reject</Button></span>],
          ["CB-2607", "Citrus Burst Gummies", "Gulf Coast Labs", "ok · sha256 match", <StatusPill key="d" tone="warn">Heavy metals pending</StatusPill>, <span key="a" className="flex gap-2"><Button variant="secondary" size="sm">Hold</Button></span>],
          ["DH-2606", "Diesel Haze THCA", "Redbud Testing Group", "ok · sha256 match", <StatusPill key="d" tone="bad">Values ≠ file</StatusPill>, <span key="a" className="flex gap-2"><Button variant="danger" size="sm">Reject + flag</Button></span>],
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Expiration queue (≤ 30 days)</h2>
      <QueueTable
        headers={["Batch", "Product", "Vendor", "Retest due", "Status", ""]}
        rows={[
          ["WC-2604", "White CBG Flower", "Blue Ridge Hemp Co.", "Jul 30, 2026", <StatusPill key="s" tone="warn">Vendor notified</StatusPill>, <Button key="a" variant="ghost" size="sm">Details</Button>],
          ["SL-B-2606", "Lift THC Seltzer", "Solstice Labs", "Dec 1, 2026", <StatusPill key="s" tone="neutral">On track</StatusPill>, <Button key="a" variant="ghost" size="sm">Details</Button>],
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Jurisdiction rules</h2>
      <QueueTable
        headers={["Scope", "Category / cannabinoid", "Effect", "Notice", ""]}
        rows={[
          ["US → all", "All", <StatusPill key="e" tone="ok">Allow</StatusPill>, "—", <Button key="a" variant="ghost" size="sm">Edit</Button>],
          ["US-ID", "THCA Flower", <StatusPill key="e" tone="bad">Deny</StatusPill>, "Not shippable to Idaho", <Button key="a" variant="ghost" size="sm">Edit</Button>],
          ["Cross-border US⇄CA", "All cannabinoids", <StatusPill key="e" tone="bad">Deny (default)</StatusPill>, "Cross-border unavailable", <Button key="a" variant="ghost" size="sm">Edit</Button>],
        ]}
      />
    </DashboardShell>
  );
}
