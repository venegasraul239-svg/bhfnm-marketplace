import type { Metadata } from "next";
import { BUYER_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export const metadata: Metadata = { title: "Disputes", robots: { index: false } };

export default function DisputesPage() {
  return (
    <DashboardShell title="Disputes" nav={BUYER_NAV} active="/disputes">
      <div className="mb-6 rounded-card border border-ink-700 bg-ink-900/40 p-5 text-sm leading-relaxed text-mist-400">
        <h2 className="mb-2 font-semibold text-mist-100">How disputes work</h2>
        Report an issue within <strong className="text-mist-200">48 hours of delivery</strong>. The seller has 48
        hours to respond. Marketplace admins review tracking, photos, batch/COA data, and message history, then issue
        a final decision — full refund, partial refund, denial, or return-required. Vendor payouts stay held while a
        dispute is open. Covered: damaged, wrong, materially different, missing items, verified shipment failure.
        Not covered: change of mind, subjective taste/effects, unread listing details, used consumables.
      </div>
      <QueueTable
        headers={["Dispute", "Order", "Reason", "Status", "Updated", ""]}
        rows={[
          ["#D-1042", "BH-2605-C3D8E0", "Missing items (1 of 3 jars)", <StatusPill key="s" tone="ok">Resolved · partial refund</StatusPill>, "Jun 12, 2026", <Button key="a" variant="ghost" size="sm">View</Button>],
        ]}
      />
    </DashboardShell>
  );
}
