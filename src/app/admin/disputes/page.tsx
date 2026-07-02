import { ADMIN_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminDisputes() {
  return (
    <DashboardShell title="Disputes" nav={ADMIN_NAV} active="/admin/disputes">
      <QueueTable
        headers={["Dispute", "Order", "Reason", "State", "Evidence", "Decision tools"]}
        rows={[
          [
            "#D-1057", "BH-2606-88AC12", "Damaged (photos attached)",
            <StatusPill key="s" tone="warn">Under admin review</StatusPill>,
            "Buyer: 4 photos · Seller: packing video · Tracking: delivered",
            <span key="a" className="flex flex-wrap gap-2">
              <Button size="sm">Full refund</Button>
              <Button variant="secondary" size="sm">Partial</Button>
              <Button variant="ghost" size="sm">Deny</Button>
              <Button variant="ghost" size="sm">Require return</Button>
            </span>,
          ],
          [
            "#D-1058", "BH-2607-11EE09", "Verified shipment failure",
            <StatusPill key="s" tone="bad">Awaiting seller response (14h left)</StatusPill>,
            "Tracking: no acceptance scan in 5 days · payout auto-held",
            <span key="a" className="flex flex-wrap gap-2">
              <Button size="sm">Refund buyer</Button>
              <Button variant="danger" size="sm">Escalate vendor risk</Button>
            </span>,
          ],
        ]}
      />
      <p className="mt-4 text-xs leading-relaxed text-mist-400">
        Opening a dispute automatically holds the vendor payout for that order. Decisions write to the audit log and
        adjust vendor risk scores; repeated fault raises reserves and can trigger suspension review. Evidence bundles
        are exportable.
      </p>
    </DashboardShell>
  );
}
