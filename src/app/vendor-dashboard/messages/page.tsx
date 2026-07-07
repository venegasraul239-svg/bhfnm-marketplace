// Vendor inbox — buyer inquiries and order threads for this store.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { SendBox } from "@/components/SendBox";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  thread_type: string;
  order_id: string | null;
  buyer: { email: string } | null;
  messages: { id: string; sender_role: string; body: string; flagged: boolean; created_at: string }[];
}

export default async function VendorMessages({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Messages" nav={VENDOR_NAV} active="/vendor-dashboard/messages">
        <EmptyState title="No approved store on this account" />
      </DashboardShell>
    );
  }

  const { data } = await db
    .from("message_threads")
    .select(
      `id, thread_type, order_id, buyer:profiles!message_threads_buyer_id_fkey(email),
       messages(id, sender_role, body, flagged, created_at)`
    )
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });

  const threads = (data ?? []) as unknown as ThreadRow[];
  const active = t ? threads.find((th) => th.id === t) : undefined;

  return (
    <DashboardShell title="Messages" nav={VENDOR_NAV} active="/vendor-dashboard/messages" badge={vendor.brand_name}>
      <p className="mb-6 text-sm text-mist-400">
        Fast, on-platform replies improve your seller rating. Sharing contact details or requesting
        off-platform payment is flagged automatically and reviewed by admins.
      </p>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div>
          {threads.length === 0 ? (
            <EmptyState title="No buyer messages yet" sub="Inquiries from storefront visitors and order threads land here." />
          ) : (
            <ul className="space-y-2">
              {threads.map((th) => (
                <li key={th.id}>
                  <a
                    href={`/marketplace/vendor-dashboard/messages?t=${th.id}`}
                    className={`card-surface block rounded-card px-4 py-3 text-sm hover:border-jade-500/50 ${
                      active?.id === th.id ? "border-jade-500/60" : ""
                    }`}
                  >
                    <span className="font-semibold text-mist-100">{th.buyer?.email ?? "Buyer"}</span>
                    <span className="mt-0.5 block text-xs text-mist-400">
                      {th.order_id ? "Order thread" : "Product inquiry"} · {th.messages.length} message
                      {th.messages.length === 1 ? "" : "s"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {active ? (
            <div className="card-surface rounded-card p-5">
              <h2 className="text-sm font-semibold text-mist-100">
                {active.buyer?.email}{" "}
                <span className="font-normal text-mist-400">· {active.order_id ? "order thread" : "inquiry"}</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {active.messages
                  .slice()
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((m) => (
                    <li
                      key={m.id}
                      className={`max-w-[85%] rounded-lg border px-3.5 py-2.5 text-sm ${
                        m.sender_role === "vendor"
                          ? "ml-auto border-jade-500/30 bg-jade-500/10 text-mist-100"
                          : "border-ink-700 bg-ink-800/60 text-mist-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-1 text-[10px] text-mist-500">
                        {m.sender_role} · {new Date(m.created_at).toLocaleString()}{" "}
                        {m.flagged && <StatusPill tone="warn">flagged</StatusPill>}
                      </p>
                    </li>
                  ))}
              </ul>
              <SendBox threadId={active.id} />
            </div>
          ) : (
            <EmptyState title="Select a conversation" />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
