import { ADMIN_NAV, DashboardShell, QueueTable, StatCards } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminPayouts() {
  return (
    <DashboardShell title="Payout queue" nav={ADMIN_NAV} active="/admin/payouts">
      <StatCards
        items={[
          { label: "Queued", value: "$12,380" },
          { label: "Held", value: "$1,120", tone: "warn" },
          { label: "In reserve (all vendors)", value: "$6,204" },
          { label: "Paid this month", value: "$38,905" },
        ]}
      />
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-mist-100">Awaiting approval</h2>
      <QueueTable
        headers={["Vendor", "Amount", "Orders", "Wallet", "Checks", "Action"]}
        rows={[
          ["Blue Ridge Hemp Co.", "$1,940.00", "9 completed", "bc1q…8k2f · verified", <StatusPill key="c" tone="ok">All clear</StatusPill>, <span key="a" className="flex gap-2"><Button size="sm">Approve</Button><Button variant="ghost" size="sm">Notes</Button></span>],
          ["Solstice Labs", "$3,210.00", "17 completed", "lnurl…p0d3 · verified", <StatusPill key="c" tone="ok">All clear</StatusPill>, <span key="a" className="flex gap-2"><Button size="sm">Approve</Button><Button variant="ghost" size="sm">Notes</Button></span>],
          ["Peak Extracts", "$1,120.00", "4 completed", "bc1q…77aa · verified", <StatusPill key="c" tone="bad">Held: open dispute + tracking flags</StatusPill>, <span key="a" className="flex gap-2"><Button variant="secondary" size="sm" disabled>Blocked</Button></span>],
        ]}
      />
      <p className="mt-4 text-xs text-mist-400">
        Manual approval at launch: approve → send BTC/LN from platform wallet → record txid. Reserve schedule and
        holds are computed automatically; every action is audit-logged. CSV export available.
      </p>
    </DashboardShell>
  );
}
