import { ADMIN_NAV, DashboardShell, QueueTable } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function AdminProducts() {
  return (
    <DashboardShell title="Product review" nav={ADMIN_NAV} active="/admin/products">
      <p className="mb-6 text-sm text-mist-400">
        Nothing publishes without passing this queue. Checklist per listing: required fields, image quality,
        structured COA present & matching, cannabinoid values vs category rules, jurisdiction list sanity.
      </p>
      <QueueTable
        headers={["Product", "Vendor", "Category", "COA", "Submitted", "Action"]}
        rows={[
          ["Mountain Mist Pre-Rolls", "Blue Ridge Hemp Co.", "Pre-Rolls", <StatusPill key="c" tone="warn">Missing solvent panel</StatusPill>, "Jun 30", <span key="a" className="flex gap-2"><Button size="sm">Approve</Button><Button variant="secondary" size="sm">Request changes</Button></span>],
          ["Citrus Burst Gummies", "Coastal Extracts", "Gummies", <StatusPill key="c" tone="ok">Verified match</StatusPill>, "Jun 29", <span key="a" className="flex gap-2"><Button size="sm">Approve</Button><Button variant="secondary" size="sm">Request changes</Button></span>],
          ["Diesel Haze THCA 14g", "High Plains Processing", "THCA Flower", <StatusPill key="c" tone="bad">Potency mismatch vs file</StatusPill>, "Jun 28", <span key="a" className="flex gap-2"><Button variant="danger" size="sm">Reject</Button><Button variant="secondary" size="sm">Request changes</Button></span>],
        ]}
      />
      <p className="mt-4 text-xs text-mist-400">
        Post-approval edits to potency, COA, batch, category, or jurisdictions automatically re-enter this queue.
      </p>
    </DashboardShell>
  );
}
