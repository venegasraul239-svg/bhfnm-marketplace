// Buyer orders — the signed-in buyer's real orders only.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { EmptyState, StatusPill } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  paid: "info", accepted: "info", label_created: "info", shipped: "info",
  delivered: "ok", completed: "ok", pending_payment: "warn",
  payment_processing: "warn", expired_payment: "neutral",
  cancelled: "bad", refunded: "neutral", partially_refunded: "neutral",
};

export default async function OrdersPage() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/orders");

  const db = supabaseService();
  const { data: orders } = db
    ? await db
        .from("orders")
        .select("id, order_number, status, total_cents, created_at, vendor:vendors(brand_name)")
        .eq("buyer_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const rows = orders ?? [];

  return (
    <DashboardShell title="Your orders" nav={BUYER_NAV} active="/orders">
      {rows.length === 0 ? (
        <EmptyState
          title="No orders yet"
          sub="When you check out with Bitcoin or Lightning, your orders and their live status appear here."
          action={<Link href="/" className="text-sm font-semibold text-jade-300 underline">Browse the marketplace →</Link>}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => {
            const vendor = o.vendor as unknown as { brand_name: string } | null;
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card-surface flex items-center justify-between gap-4 rounded-card px-5 py-4 text-sm transition-colors hover:border-jade-500/50">
                  <span>
                    <span className="font-semibold text-mist-100">{o.order_number}</span>
                    <span className="ml-2 text-mist-400">{vendor?.brand_name}</span>
                    <p className="mt-0.5 text-xs text-mist-400">{new Date(o.created_at).toLocaleString()}</p>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-mist-100">{formatPrice(o.total_cents)}</span>
                    <StatusPill tone={TONE[o.status] ?? "neutral"}>{o.status.replace(/_/g, " ")}</StatusPill>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
