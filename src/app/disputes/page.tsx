// Buyer disputes — real records only; intake opens per-order after delivery.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const metadata: Metadata = { title: "Disputes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/disputes");

  const db = supabaseService();
  const { data: disputes } = db
    ? await db
        .from("disputes")
        .select("id, reason, description, status, created_at, order:orders(order_number), vendor:vendors(brand_name)")
        .eq("buyer_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const rows = disputes ?? [];

  return (
    <DashboardShell title="Disputes" nav={BUYER_NAV} active="/disputes">
      <p className="mb-6 text-sm text-mist-400">
        Eligible issues: damaged, wrong, or materially different items; missing items; verified shipment failure.
        You have 48 hours after delivery to open a dispute from the order page. Marketplace admins decide outcomes.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="No disputes"
          sub="If a delivery goes wrong, open a dispute from that order's page within the 48-hour window."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const order = d.order as unknown as { order_number: string } | null;
            const vendor = d.vendor as unknown as { brand_name: string } | null;
            return (
              <li key={d.id} className="card-surface rounded-card px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-mist-100">{order?.order_number} · {vendor?.brand_name}</span>
                  <StatusPill tone={["resolved", "closed", "refund_approved"].includes(d.status) ? "ok" : "warn"}>
                    {d.status.replace(/_/g, " ")}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs text-mist-400">{d.reason.replace(/_/g, " ")} · {new Date(d.created_at).toLocaleDateString()}</p>
                <p className="mt-1.5 text-mist-300">{d.description}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
