import { DashboardShell, QueueTable, StatCards, VENDOR_NAV } from "@/components/DashboardShell";
import { StatusPill } from "@/components/ui";

export default function VendorOverview() {
  return (
    <DashboardShell title="Vendor dashboard" nav={VENDOR_NAV} active="/vendor-dashboard" badge="Blue Ridge Hemp Co.">
      <StatCards
        items={[
          { label: "Sales (30d)", value: "$4,812" },
          { label: "Orders to ship", value: "3", tone: "warn" },
          { label: "Payout eligible", value: "$1,940" },
          { label: "Open disputes", value: "0", tone: "ok" },
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Action queue</h2>
      <QueueTable
        headers={["Priority", "Item", "Detail", "Due"]}
        rows={[
          [<StatusPill key="1" tone="warn">Ship now</StatusPill>, "Order BH-2607-4F2A1C", "2× Appalachian Haze 7g — label ready, awaiting drop-off scan", "Today"],
          [<StatusPill key="2" tone="warn">Ship now</StatusPill>, "Order BH-2607-8B03D9", "1× White CBG 3.5g — generate label", "Today"],
          [<StatusPill key="3" tone="info">COA expiring</StatusPill>, "Batch WC-2604", "Retest due in 28 days — upload new COA to keep badges", "Jul 30"],
          [<StatusPill key="4" tone="neutral">Changes requested</StatusPill>, "Draft: Mountain Mist Pre-Rolls", "Admin note: add residual solvent panel result", "—"],
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Listing improvement hints</h2>
      <ul className="space-y-2 text-sm text-mist-400">
        <li>• Add a third product image to “Cedar Stash Jar” — listings with 3+ images rank better.</li>
        <li>• Your average acceptance-scan lag is 1.4 days; same-day drop-offs improve your shipping score.</li>
        <li>• Batch WC-2604 approaches retest date — recent COAs keep the “Recently Tested” badge.</li>
      </ul>
    </DashboardShell>
  );
}
