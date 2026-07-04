// Vendor inbox — real threads only; sending UI arrives with the messaging
// milestone (threads created by the application/dispute flows are visible).

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function VendorMessages() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Messages" nav={VENDOR_NAV} active="/vendor-dashboard/messages">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const { data: threads } = await db
    .from("message_threads")
    .select("id, thread_type, created_at, messages(body, sender_role, created_at)")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = threads ?? [];

  return (
    <DashboardShell title="Messages" nav={VENDOR_NAV} active="/vendor-dashboard/messages" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        All buyer communication stays in this inbox — off-platform contact (email, phone, wallets, chat apps) is
        detected and flagged. Replying from this view ships with the messaging milestone; threads shown are real.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          sub="Order questions and product inquiries open threads here automatically."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const last = (t.messages ?? []).slice(-1)[0];
            return (
              <li key={t.id} className="card-surface rounded-card px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-mist-400">
                  {t.thread_type.replace(/_/g, " ")} · {new Date(t.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 truncate text-mist-200">{last ? `${last.sender_role}: ${last.body}` : "No messages yet"}</p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
