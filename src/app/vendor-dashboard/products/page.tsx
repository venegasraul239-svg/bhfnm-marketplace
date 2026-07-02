import { DashboardShell, QueueTable, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorProducts() {
  return (
    <DashboardShell title="Products" nav={VENDOR_NAV} active="/vendor-dashboard/products">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist-400">
          New and edited listings go to compliance review before publishing — status changes are never automatic.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Import CSV / Shopify / Woo</Button>
          <Button size="sm">New draft listing</Button>
        </div>
      </div>
      <QueueTable
        headers={["Product", "Status", "Batch / COA", "Stock", "Action"]}
        rows={[
          ["Appalachian Haze CBD Flower", <StatusPill key="s" tone="ok">Live</StatusPill>, "AH-2605 · Verified", "121 units", <Button key="a" variant="ghost" size="sm">Edit</Button>],
          ["White CBG Flower — Frosted Cut", <StatusPill key="s" tone="ok">Live</StatusPill>, "WC-2604 · Verified (retest soon)", "52 units", <Button key="a" variant="ghost" size="sm">Edit</Button>],
          ["Cedar Stash Jar — UV Glass", <StatusPill key="s" tone="ok">Live</StatusPill>, "n/a (accessory)", "90 units", <Button key="a" variant="ghost" size="sm">Edit</Button>],
          ["Mountain Mist Pre-Rolls", <StatusPill key="s" tone="warn">Changes requested</StatusPill>, "MM-2606 · Submitted", "—", <Button key="a" variant="ghost" size="sm">Fix &amp; resubmit</Button>],
          ["Harvest 2026 Smalls", <StatusPill key="s" tone="neutral">Draft</StatusPill>, "COA missing", "—", <Button key="a" variant="ghost" size="sm">Complete</Button>],
        ]}
      />
    </DashboardShell>
  );
}
