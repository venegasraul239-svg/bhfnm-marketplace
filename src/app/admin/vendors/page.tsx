// Admin vendor review — real applications and stores only. Empty queues render
// as empty queues.

import { DashboardShell, ADMIN_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { DecisionPanel } from "./DecisionPanel";
import { VendorControls } from "./VendorControls";

export const dynamic = "force-dynamic";

interface AppRow {
  id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  steps: Record<string, Record<string, string | boolean>>;
  applicant: { email: string } | null;
}

interface VendorRow {
  id: string;
  slug: string;
  brand_name: string;
  seller_type: string;
  status: string;
  joined_at: string;
}

export default async function AdminVendorsPage() {
  const db = supabaseService();

  const { data: apps } = db
    ? await db
        .from("vendor_applications")
        .select("id, status, submitted_at, created_at, steps, applicant:profiles!vendor_applications_applicant_id_fkey(email)")
        .in("status", ["submitted", "resubmitted", "under_review", "info_requested"])
        .order("submitted_at", { ascending: true })
    : { data: null };

  const { data: vendors } = db
    ? await db
        .from("vendors")
        .select("id, slug, brand_name, seller_type, status, joined_at")
        .order("joined_at", { ascending: false })
    : { data: null };

  const queue = (apps ?? []) as unknown as AppRow[];
  const stores = (vendors ?? []) as unknown as VendorRow[];

  return (
    <DashboardShell title="Vendor review" nav={ADMIN_NAV} active="/admin/vendors">
      <h2 className="mb-4 font-display text-lg font-bold text-mist-100">
        Application queue <span className="text-sm font-normal text-mist-400">({queue.length})</span>
      </h2>

      {queue.length === 0 ? (
        <EmptyState
          title="No applications waiting"
          sub="New vendor applications appear here the moment they are submitted."
        />
      ) : (
        <div className="space-y-4">
          {queue.map((a) => {
            const s0 = a.steps?.["0"] ?? {};
            const s2 = a.steps?.["2"] ?? {};
            return (
              <div key={a.id} className="card-surface rounded-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-mist-100">
                      {String(s2.brandName ?? s0.company ?? "Unnamed applicant")}
                      <span className="ml-2 text-xs font-normal text-mist-400">{a.applicant?.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-mist-400">
                      {String(s0.sellerType ?? "—")} · {String(s0.region ?? "?")}, {String(s0.country ?? "?")} ·
                      applied {new Date(a.submitted_at ?? a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusPill tone={a.status === "info_requested" ? "warn" : "info"}>
                    {a.status.replace(/_/g, " ")}
                  </StatusPill>
                </div>

                <dl className="mt-4 grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                  {[
                    ["Legal name", a.steps?.["1"]?.legalName],
                    ["EIN/Tax ID", a.steps?.["1"]?.ein],
                    ["Wallet", a.steps?.["1"]?.walletAddress],
                    ["Categories", a.steps?.["3"]?.categories],
                    ["Cannabinoids", a.steps?.["3"]?.cannabinoids],
                    ["Lab partners", a.steps?.["3"]?.labs],
                    ["COA process", a.steps?.["3"]?.coaProcess],
                    ["Requested slug", s2.slug],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex gap-2">
                      <dt className="w-28 shrink-0 text-mist-400">{String(label)}</dt>
                      <dd className="truncate text-mist-200">{value ? String(value) : "—"}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 border-t border-ink-700 pt-4">
                  <DecisionPanel applicationId={a.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-4 mt-12 font-display text-lg font-bold text-mist-100">
        Active stores <span className="text-sm font-normal text-mist-400">({stores.length})</span>
      </h2>
      {stores.length === 0 ? (
        <EmptyState title="No stores yet" sub="Approved applications become storefronts listed here." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Storefront</th>
                <th className="px-4 py-3">Superadmin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {stores.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-mist-100">{v.brand_name}</td>
                  <td className="px-4 py-3 text-mist-300">{v.seller_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={v.status === "active" ? "ok" : "bad"}>{v.status}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-mist-300">{new Date(v.joined_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <a href={`/marketplace/store/${v.slug}`} className="text-jade-300 hover:underline">/{v.slug}</a>
                  </td>
                  <td className="px-4 py-3">
                    <VendorControls vendorId={v.id} status={v.status} />
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
