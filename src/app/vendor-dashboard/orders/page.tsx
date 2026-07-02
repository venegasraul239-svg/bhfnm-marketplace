import { DashboardShell, QueueTable, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorOrders() {
  return (
    <DashboardShell title="Orders" nav={VENDOR_NAV} active="/vendor-dashboard/orders">
      <p className="mb-6 text-sm text-mist-400">
        Orders can only be marked shipped through a platform-generated label with a carrier acceptance scan.
        Handling-time deadlines are shown per order.
      </p>
      <QueueTable
        headers={["Order", "Items", "Paid", "Status", "Handling deadline", "Action"]}
        rows={[
          ["BH-2607-4F2A1C", "2× Appalachian Haze 7g", "₿ settled", <StatusPill key="s" tone="warn">Awaiting shipment</StatusPill>, "Today 5pm", <Button key="a" size="sm">Generate label</Button>],
          ["BH-2607-8B03D9", "1× White CBG 3.5g", "⚡ settled", <StatusPill key="s" tone="warn">Awaiting shipment</StatusPill>, "Today 5pm", <Button key="a" size="sm">Generate label</Button>],
          ["BH-2606-E19A44", "1× Appalachian Haze 28g", "₿ settled", <StatusPill key="s" tone="info">In transit</StatusPill>, "—", <Button key="a" variant="ghost" size="sm">Tracking</Button>],
          ["BH-2606-77CD02", "3× Cedar Stash Jar", "⚡ settled", <StatusPill key="s" tone="ok">Delivered · dispute window</StatusPill>, "—", <Button key="a" variant="ghost" size="sm">View</Button>],
          ["BH-2606-1A9B3E", "1× White CBG 7g", "₿ settled", <StatusPill key="s" tone="ok">Completed</StatusPill>, "—", <Button key="a" variant="ghost" size="sm">View</Button>],
        ]}
      />
    </DashboardShell>
  );
}
