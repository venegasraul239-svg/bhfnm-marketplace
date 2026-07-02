import type { Metadata } from "next";
import { BUYER_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default function OrdersPage() {
  return (
    <DashboardShell title="Your orders" nav={BUYER_NAV} active="/orders">
      <QueueTable
        headers={["Order", "Seller", "Total", "Payment", "Status", ""]}
        rows={[
          ["BH-2607-4F2A1C", "Blue Ridge Hemp Co.", "$84.00", "₿ settled", <StatusPill key="s" tone="info">Preparing shipment</StatusPill>, <Button key="a" variant="ghost" size="sm" href="/orders/demo">Track</Button>],
          ["BH-2606-90AA17", "Solstice Labs", "$39.00", "⚡ settled", <StatusPill key="s" tone="ok">Delivered · review requested</StatusPill>, <Button key="a" size="sm" href="/orders/demo">Leave review</Button>],
          ["BH-2605-C3D8E0", "High Plains Processing", "$119.00", "₿ settled", <StatusPill key="s" tone="ok">Completed</StatusPill>, <Button key="a" variant="ghost" size="sm" href="/orders/demo">View</Button>],
        ]}
      />
      <p className="mt-6 text-xs leading-relaxed text-mist-400">
        Each order is fulfilled by a single seller with platform-generated tracking. After delivery you have 48 hours
        to open a dispute for damaged, wrong, missing, or materially different items.
      </p>
    </DashboardShell>
  );
}
