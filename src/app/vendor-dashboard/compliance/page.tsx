import { DashboardShell, QueueTable, VENDOR_NAV } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";

export default function VendorCompliance() {
  return (
    <DashboardShell title="Compliance" nav={VENDOR_NAV} active="/vendor-dashboard/compliance">
      <p className="mb-6 text-sm text-mist-400">
        Every batch needs a structured COA record: file upload (hash-verified), lab details, potency values, and
        safety panels. Verified records power your public badges; expired COAs remove them automatically.
      </p>
      <QueueTable
        headers={["Batch", "Product", "Lab", "Issued", "Retest", "Status", "Action"]}
        rows={[
          ["AH-2605", "Appalachian Haze CBD Flower", "Foothills Analytical", "May 18, 2026", "May 18, 2027", <StatusPill key="s" tone="ok">Verified</StatusPill>, <Button key="a" variant="ghost" size="sm">View</Button>],
          ["WC-2604", "White CBG Flower", "Foothills Analytical", "Apr 30, 2026", "Apr 30, 2027", <StatusPill key="s" tone="warn">Retest in 28d</StatusPill>, <Button key="a" size="sm">Upload new COA</Button>],
          ["MM-2606", "Mountain Mist Pre-Rolls", "Foothills Analytical", "Jun 12, 2026", "—", <StatusPill key="s" tone="info">Under review</StatusPill>, <Button key="a" variant="ghost" size="sm">Details</Button>],
        ]}
      />
      <div className="mt-8 rounded-card border border-ink-700 bg-ink-900/40 p-6 text-sm leading-relaxed text-mist-400">
        <h2 className="mb-2 font-semibold text-mist-100">What reviewers check</h2>
        Batch number matches the COA document · lab exists and issues this panel type · potency values match the file ·
        safety panels present for the category (vapes/edibles need solvents) · issue date fresh · file hash matches upload.
      </div>
    </DashboardShell>
  );
}
