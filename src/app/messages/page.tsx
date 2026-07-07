// Buyer inbox — real threads with this account's vendors. ?t=<id> opens a
// thread; ?vendor=<slug> composes a new inquiry to that store.

import { redirect } from "next/navigation";
import { EmptyState, StatusPill } from "@/components/ui";
import { SendBox } from "@/components/SendBox";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  thread_type: string;
  order_id: string | null;
  vendor: { brand_name: string; slug: string } | null;
  messages: { id: string; sender_role: string; body: string; flagged: boolean; created_at: string }[];
}

export default async function BuyerMessages({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; vendor?: string }>;
}) {
  const { t, vendor: vendorSlug } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/messages");
  const db = supabaseService();

  const { data } = db
    ? await db
        .from("message_threads")
        .select(
          `id, thread_type, order_id, vendor:vendors(brand_name, slug),
           messages(id, sender_role, body, flagged, created_at)`
        )
        .eq("buyer_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const threads = ((data ?? []) as unknown as ThreadRow[]).filter((th) => th.thread_type !== "application");
  const active = t ? threads.find((th) => th.id === t) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-black text-mist-100">Messages</h1>
      <p className="mt-2 text-sm text-mist-400">
        All buyer–seller communication stays in the marketplace inbox. Messages can&apos;t be edited
        or deleted, and sharing contact details or off-platform payment instructions is flagged.
      </p>

      {vendorSlug && !active && (
        <div className="card-surface mt-6 rounded-card p-5">
          <h2 className="text-sm font-semibold text-mist-100">New message to /{vendorSlug}</h2>
          <SendBox vendorSlug={vendorSlug} />
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-[280px_1fr]">
        <div>
          {threads.length === 0 ? (
            <EmptyState title="No conversations yet" sub="Message a seller from their storefront or an order page." />
          ) : (
            <ul className="space-y-2">
              {threads.map((th) => (
                <li key={th.id}>
                  <a
                    href={`/marketplace/messages?t=${th.id}`}
                    className={`card-surface block rounded-card px-4 py-3 text-sm hover:border-jade-500/50 ${
                      active?.id === th.id ? "border-jade-500/60" : ""
                    }`}
                  >
                    <span className="font-semibold text-mist-100">{th.vendor?.brand_name ?? "Store"}</span>
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
                {active.vendor?.brand_name}{" "}
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
                        m.sender_role === "buyer"
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
            !vendorSlug && (
              <EmptyState title="Select a conversation" sub="Threads open here with full history and a composer." />
            )
          )}
        </div>
      </div>
    </div>
  );
}
