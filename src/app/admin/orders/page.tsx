import { ADMIN_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminOrders() {
  return (
    <DashboardShell title="Orders & payments" nav={ADMIN_NAV} active="/admin/orders">
      <QueueTable
        headers={["Order", "Vendor", "Total", "Invoice", "Shipping", "Status", ""]}
        rows={[
          ["BH-2607-4F2A1C", "Blue Ridge Hemp Co.", "$84.00", <StatusPill key="i" tone="ok">Settled ₿</StatusPill>, "In transit (scan ok)", <StatusPill key="s" tone="info">Shipped</StatusPill>, <Button key="a" variant="ghost" size="sm">Inspect</Button>],
          ["BH-2607-11EE09", "Peak Extracts", "$210.00", <StatusPill key="i" tone="ok">Settled ⚡</StatusPill>, <StatusPill key="t" tone="bad">No acceptance scan · 5d</StatusPill>, <StatusPill key="s" tone="warn">Late</StatusPill>, <Button key="a" variant="danger" size="sm">Intervene</Button>],
          ["BH-2607-3C7B21", "Solstice Labs", "$99.00", <StatusPill key="i" tone="warn">Underpaid −4%</StatusPill>, "—", <StatusPill key="s" tone="warn">Payment issue</StatusPill>, <Button key="a" variant="secondary" size="sm">Resolve</Button>],
          ["BH-2607-90D5F0", "High Plains Processing", "$2,400.00", <StatusPill key="i" tone="neutral">Invoice expired</StatusPill>, "—", <StatusPill key="s" tone="neutral">Cancelled</StatusPill>, <Button key="a" variant="ghost" size="sm">View</Button>],
        ]}
      />
      <p className="mt-4 text-xs leading-relaxed text-mist-400">
        Every BTCPay webhook event is recorded on the payment row (idempotent by delivery id). Underpayments never
        auto-confirm; overpayment deltas post to the ledger for refund. Severe non-shipment triggers auto-cancel
        eligibility and refund workflow.
      </p>
    </DashboardShell>
  );
}
