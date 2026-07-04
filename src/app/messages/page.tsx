// Buyer inbox — real threads only (application Q&A, order threads).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/messages");

  const db = supabaseService();
  const { data: threads } = db
    ? await db
        .from("message_threads")
        .select("id, thread_type, created_at, vendor:vendors(brand_name), messages(body, sender_role, created_at)")
        .eq("buyer_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const rows = threads ?? [];

  return (
    <DashboardShell title="Messages" nav={BUYER_NAV} active="/messages">
      <p className="mb-6 text-sm text-mist-400">
        All conversations stay on-platform. Vendors asking to move to email, chat apps, or direct payment are
        violating policy — report it.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          sub="Order questions, seller replies, and application review messages appear here."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const vendor = t.vendor as unknown as { brand_name: string } | null;
            const last = (t.messages ?? []).slice(-1)[0];
            return (
              <li key={t.id} className="card-surface rounded-card px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-mist-400">
                  {t.thread_type.replace(/_/g, " ")}{vendor ? ` · ${vendor.brand_name}` : ""} ·{" "}
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 truncate text-mist-200">
                  {last ? `${last.sender_role === "admin" ? "Review team" : last.sender_role}: ${last.body}` : "No messages yet"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
