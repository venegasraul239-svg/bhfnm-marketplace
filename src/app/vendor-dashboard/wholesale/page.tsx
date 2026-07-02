import { DashboardShell, QueueTable, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorWholesale() {
  return (
    <DashboardShell title="Wholesale" nav={VENDOR_NAV} active="/vendor-dashboard/wholesale">
      <p className="mb-6 text-sm text-mist-400">
        Approve wholesale buyers individually — approved buyers see your wholesale-only variants and tiered pricing.
        Repeat wholesale orders track referral attribution for commission purposes.
      </p>
      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Access requests</h2>
      <QueueTable
        headers={["Buyer", "Company", "Type", "Resale cert", "Status", "Action"]}
        rows={[
          ["j.alvarez@…", "Green Door Retail LLC", "Retail store", "Provided (TX)", <StatusPill key="s" tone="warn">Pending</StatusPill>, <Button key="a" size="sm">Review</Button>],
          ["purchasing@…", "Herbline Distribution", "Distributor", "Provided (FL)", <StatusPill key="s" tone="ok">Approved</StatusPill>, <Button key="a" variant="ghost" size="sm">Manage</Button>],
        ]}
      />
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-mist-100">Wholesale & private-label inquiries</h2>
      <QueueTable
        headers={["Date", "Buyer", "Type", "Detail", ""]}
        rows={[
          ["Jun 30", "Green Door Retail", "Wholesale", "Interested in 5 lb monthly smalls supply", <Button key="a" variant="ghost" size="sm">Open thread</Button>],
          ["Jun 24", "Peak Wellness Co.", "Private label", "White-label CBG flower, 500 units/mo", <Button key="a" variant="ghost" size="sm">Open thread</Button>],
        ]}
      />
    </DashboardShell>
  );
}
