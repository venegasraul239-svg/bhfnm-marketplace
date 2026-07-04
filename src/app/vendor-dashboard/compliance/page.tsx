// Vendor compliance — real COA records for this vendor's products.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  verified: "ok", expiring_soon: "warn", expired: "bad", rejected: "bad", submitted: "info",
};

export default async function VendorCompliance() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Compliance" nav={VENDOR_NAV} active="/vendor-dashboard/compliance">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const { data: products } = await db
    .from("products")
    .select(
      `id, title, status,
       compliance:compliance_records(id, batch_number, lab_name, coa_issue_date, retest_date, status, admin_notes)`
    )
    .eq("vendor_id", vendor.id)
    .order("updated_at", { ascending: false });

  const records = (products ?? []).flatMap((p) =>
    (p.compliance ?? []).map((c) => ({ ...c, productTitle: p.title }))
  );

  return (
    <DashboardShell title="Compliance" nav={VENDOR_NAV} active="/vendor-dashboard/compliance" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        Every batch needs a structured COA record. Badges (Verified COA, Batch Linked, Recently Tested) appear only
        after admin verification, and disappear automatically past the retest date.
      </p>
      {records.length === 0 ? (
        <EmptyState
          title="No COA records yet"
          sub="Add structured COA data when creating a listing — records and their verification status appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Lab</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Retest</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-mist-100">{r.productTitle}</td>
                  <td className="px-4 py-3 text-mist-300">{r.batch_number}</td>
                  <td className="px-4 py-3 text-mist-300">{r.lab_name}</td>
                  <td className="px-4 py-3 text-mist-300">{r.coa_issue_date}</td>
                  <td className="px-4 py-3 text-mist-300">{r.retest_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</StatusPill>
                    {r.admin_notes && <p className="mt-1 text-xs text-amber-glow">{r.admin_notes}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
