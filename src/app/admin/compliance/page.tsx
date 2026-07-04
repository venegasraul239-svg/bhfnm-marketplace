// Admin compliance queue — real submitted COA records awaiting verification.

import { ADMIN_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";
import { VerifyPanel } from "./VerifyPanel";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  batch_number: string;
  lab_name: string;
  lab_website: string | null;
  coa_issue_date: string;
  retest_date: string | null;
  delta9_thc_pct: number | null;
  total_thc_pct: number | null;
  thca_pct: number | null;
  cbd_pct: number | null;
  cbg_pct: number | null;
  coa_file_hash: string;
  product: { title: string; batch_number: string | null; vendor: { brand_name: string } | null } | null;
}

export default async function AdminCompliance() {
  const db = supabaseService();
  const { data } = db
    ? await db
        .from("compliance_records")
        .select(
          `id, batch_number, lab_name, lab_website, coa_issue_date, retest_date,
           delta9_thc_pct, total_thc_pct, thca_pct, cbd_pct, cbg_pct, coa_file_hash,
           product:products(title, batch_number, vendor:vendors(brand_name))`
        )
        .eq("status", "submitted")
        .order("created_at", { ascending: true })
    : { data: null };

  const queue = (data ?? []) as unknown as Row[];

  return (
    <DashboardShell title="Compliance verification" nav={ADMIN_NAV} active="/admin/compliance">
      <p className="mb-6 text-sm text-mist-400">
        Cross-check structured values against the COA document and the lab&apos;s own records before verifying.
        Verification is what unlocks public badges — treat it accordingly.
      </p>
      {queue.length === 0 ? (
        <EmptyState title="No COAs waiting" sub="Vendor-submitted batch records appear here for verification." />
      ) : (
        <div className="space-y-4">
          {queue.map((r) => (
            <div key={r.id} className="card-surface rounded-card p-5">
              <p className="font-semibold text-mist-100">
                {r.product?.title ?? "Unknown product"}
                <span className="ml-2 text-xs font-normal text-mist-400">{r.product?.vendor?.brand_name}</span>
              </p>
              <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                {[
                  ["Batch (record)", r.batch_number],
                  ["Batch (listing)", r.product?.batch_number ?? "—"],
                  ["Lab", r.lab_website ? `${r.lab_name} (${r.lab_website})` : r.lab_name],
                  ["Issued / retest", `${r.coa_issue_date} / ${r.retest_date ?? "—"}`],
                  ["Δ9-THC / total THC", `${r.delta9_thc_pct ?? "—"}% / ${r.total_thc_pct ?? "—"}%`],
                  ["THCA / CBD / CBG", `${r.thca_pct ?? "—"}% / ${r.cbd_pct ?? "—"}% / ${r.cbg_pct ?? "—"}%`],
                  ["File hash", r.coa_file_hash],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="w-32 shrink-0 text-mist-400">{label}</dt>
                    <dd className="truncate text-mist-200">{value}</dd>
                  </div>
                ))}
              </dl>
              {r.batch_number !== r.product?.batch_number && (
                <p className="mt-2 text-xs font-semibold text-signal-red">
                  Batch mismatch between record and listing — investigate before verifying.
                </p>
              )}
              <div className="mt-4 border-t border-ink-700 pt-4">
                <VerifyPanel recordId={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
