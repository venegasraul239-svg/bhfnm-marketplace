// Vendor wholesale — real access requests and inquiries for this vendor.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function VendorWholesale() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Wholesale" nav={VENDOR_NAV} active="/vendor-dashboard/wholesale">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const [{ data: access }, { data: inquiries }] = await Promise.all([
    db.from("wholesale_access")
      .select("buyer_id, status, decided_at, buyer:profiles(email), profile:wholesale_profiles(company_name, business_type)")
      .eq("vendor_id", vendor.id),
    db.from("wholesale_inquiries")
      .select("id, inquiry_type, message, status, created_at, buyer:profiles(email)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <DashboardShell title="Wholesale" nav={VENDOR_NAV} active="/vendor-dashboard/wholesale" badge={vendor.brand_name}>
      {!vendor.wholesale_enabled && (
        <p className="mb-6 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-sm text-amber-glow">
          Wholesale is not enabled for your store. Contact the review team via your application thread to enable it.
        </p>
      )}

      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Buyer access requests</h2>
      {(access ?? []).length === 0 ? (
        <EmptyState
          title="No wholesale access requests"
          sub="Approved wholesale buyers request access to your pricing here. Approve/deny controls ship with the wholesale milestone."
        />
      ) : (
        <ul className="space-y-2">
          {(access ?? []).map((a) => {
            const buyer = a.buyer as unknown as { email: string } | null;
            const prof = a.profile as unknown as { company_name: string; business_type: string | null } | null;
            return (
              <li key={a.buyer_id} className="card-surface flex items-center justify-between rounded-card px-4 py-3 text-sm">
                <span className="text-mist-200">
                  {prof?.company_name ?? buyer?.email ?? "Buyer"}
                  {prof?.business_type && <span className="ml-2 text-xs text-mist-400">{prof.business_type}</span>}
                </span>
                <StatusPill tone={a.status === "approved" ? "ok" : a.status === "requested" ? "info" : "bad"}>
                  {a.status}
                </StatusPill>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Inquiries</h2>
      {(inquiries ?? []).length === 0 ? (
        <EmptyState title="No wholesale or private-label inquiries yet" />
      ) : (
        <ul className="space-y-2">
          {(inquiries ?? []).map((q) => {
            const buyer = q.buyer as unknown as { email: string } | null;
            return (
              <li key={q.id} className="card-surface rounded-card px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-mist-400">
                  {q.inquiry_type.replace(/_/g, " ")} · {buyer?.email} · {new Date(q.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 text-mist-200">{q.message ?? "—"}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
