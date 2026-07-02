import type { Metadata } from "next";
import { BUYER_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function MessagesPage() {
  return (
    <DashboardShell title="Marketplace inbox" nav={BUYER_NAV} active="/messages">
      <p className="mb-6 text-sm text-mist-400">
        All seller communication happens here — never by email or external apps. Threads are linked to orders or
        product inquiries, messages are timestamped and can&apos;t be edited or deleted, and you can escalate any
        order thread to a dispute.
      </p>
      <QueueTable
        headers={["Thread", "Linked to", "Last message", "Status", ""]}
        rows={[
          ["Blue Ridge Hemp Co.", "Order BH-2607-4F2A1C", "“Label created, drops off today.” · 3h ago", <StatusPill key="s" tone="neutral">Active</StatusPill>, <Button key="a" size="sm">Open</Button>],
          ["Solstice Labs", "Product inquiry: Lift Seltzer", "“12-packs restock next week.” · 2d ago", <StatusPill key="s" tone="neutral">Active</StatusPill>, <Button key="a" variant="ghost" size="sm">Open</Button>],
        ]}
      />
    </DashboardShell>
  );
}
