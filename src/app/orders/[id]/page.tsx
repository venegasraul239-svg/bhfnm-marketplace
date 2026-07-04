// Buyer order detail — real order, items, payment, and status history.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/auth/sign-in?next=/orders/${id}`);

  const db = supabaseService();
  if (!db) notFound();

  const { data: order } = await db
    .from("orders")
    .select(
      `id, order_number, status, subtotal_cents, total_cents, created_at, destination,
       dispute_window_ends_at, delivered_at,
       vendor:vendors(brand_name, slug),
       items:order_items(title, variant_name, quantity, unit_price_cents),
       payment:payments(status, method, invoice_id, checkout_link, expires_at, settled_at),
       events:order_events(from_status, to_status, created_at)`
    )
    .eq("id", id)
    .eq("buyer_id", profile.id) // buyers can only ever load their own orders
    .maybeSingle();

  if (!order) notFound();

  const vendor = order.vendor as unknown as { brand_name: string; slug: string } | null;
  const payment = (order.payment as unknown as {
    status: string; method: string | null; invoice_id: string;
    checkout_link: string | null; expires_at: string | null; settled_at: string | null;
  }[] | null)?.[0];
  const disputeOpen =
    order.status === "delivered" &&
    order.dispute_window_ends_at &&
    new Date(order.dispute_window_ends_at) > new Date();

  return (
    <DashboardShell title={`Order ${order.order_number}`} nav={BUYER_NAV} active="/orders">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface rounded-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-mist-100">{vendor?.brand_name}</h2>
            <StatusPill tone={["delivered", "completed"].includes(order.status) ? "ok" : "info"}>
              {order.status.replace(/_/g, " ")}
            </StatusPill>
          </div>
          <ul className="mt-4 divide-y divide-ink-700 text-sm">
            {(order.items ?? []).map((i, n) => (
              <li key={n} className="flex justify-between py-2">
                <span className="text-mist-200">{i.quantity}× {i.title} <span className="text-mist-400">({i.variant_name})</span></span>
                <span className="text-mist-100">{formatPrice(i.unit_price_cents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-ink-700 pt-3 text-sm">
            <span className="text-mist-400">Total</span>
            <span className="font-bold text-mist-100">{formatPrice(order.total_cents)}</span>
          </p>
        </div>

        <div className="card-surface rounded-card p-6">
          <h2 className="font-semibold text-mist-100">Payment</h2>
          {payment ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-mist-400">Status</dt><dd className="text-mist-200">{payment.status.replace(/_/g, " ")}</dd></div>
              {payment.method && <div className="flex justify-between"><dt className="text-mist-400">Method</dt><dd className="text-mist-200">{payment.method === "lightning" ? "Lightning" : "Bitcoin on-chain"}</dd></div>}
              <div className="flex justify-between"><dt className="text-mist-400">Invoice</dt><dd className="font-mono text-xs text-mist-300">{payment.invoice_id}</dd></div>
              {payment.settled_at && <div className="flex justify-between"><dt className="text-mist-400">Settled</dt><dd className="text-mist-200">{new Date(payment.settled_at).toLocaleString()}</dd></div>}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-mist-400">No payment record.</p>
          )}
          {order.status === "pending_payment" && payment?.checkout_link && (
            <div className="mt-4">
              <Button href={payment.checkout_link} variant="btc" size="sm">Open Bitcoin invoice</Button>
              <p className="mt-2 text-[11px] text-mist-400">Invoices expire after 15 minutes; an expired order releases automatically.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card-surface mt-4 rounded-card p-6">
        <h2 className="font-semibold text-mist-100">Timeline</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="text-mist-300">Order created · {new Date(order.created_at).toLocaleString()}</li>
          {(order.events ?? []).map((e, n) => (
            <li key={n} className="text-mist-300">
              {e.from_status ? `${e.from_status} → ` : ""}{e.to_status.replace(/_/g, " ")} · {new Date(e.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-mist-400">
          Shipping events appear here once the vendor generates the platform tracking label. After delivery you have
          48 hours to report damaged, wrong, missing, or materially different items.
        </p>
        {disputeOpen && (
          <div className="mt-4">
            <Button href="/disputes" variant="secondary" size="sm">Report an issue with this order</Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
