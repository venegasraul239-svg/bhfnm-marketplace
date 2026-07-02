import { DashboardShell, QueueTable, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorMessages() {
  return (
    <DashboardShell title="Messages" nav={VENDOR_NAV} active="/vendor-dashboard/messages">
      <p className="mb-6 text-sm text-mist-400">
        All buyer communication stays in the marketplace inbox. Messages are immutable, timestamped, and monitored
        for off-platform contact or payment solicitation — sharing emails, phone numbers, wallet addresses, or
        Telegram/WhatsApp handles triggers enforcement.
      </p>
      <QueueTable
        headers={["Thread", "Linked to", "Last message", "Status", ""]}
        rows={[
          ["Marcus T.", "Order BH-2607-4F2A1C", "“Any update on shipping?” · 2h ago", <StatusPill key="s" tone="warn">Needs reply</StatusPill>, <Button key="a" size="sm">Open</Button>],
          ["Dana R.", "Product inquiry: Appalachian Haze", "“Is a fresh batch coming?” · 1d ago", <StatusPill key="s" tone="neutral">Replied</StatusPill>, <Button key="a" variant="ghost" size="sm">Open</Button>],
          ["Priya K.", "Order BH-2606-77CD02", "“Thanks, arrived safely!” · 3d ago", <StatusPill key="s" tone="ok">Resolved</StatusPill>, <Button key="a" variant="ghost" size="sm">Open</Button>],
        ]}
      />
    </DashboardShell>
  );
}
