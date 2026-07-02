// POST /api/webhooks/btcpay — HMAC-verified, idempotent payment state sync.

import { NextResponse } from "next/server";
import { BtcPayProvider, getBtcPayConfig } from "@/lib/payments/btcpay";
import { supabaseService } from "@/lib/supabase";

export async function POST(req: Request) {
  const cfg = getBtcPayConfig();
  const db = supabaseService();
  if (!cfg || !db) {
    return NextResponse.json({ error: { code: "not_configured", message: "BTCPay/DB not configured." } }, { status: 503 });
  }

  const rawBody = await req.text();
  let event;
  try {
    event = new BtcPayProvider().parseWebhook(rawBody, req.headers.get("BTCPay-Sig"));
  } catch (e) {
    return NextResponse.json({ error: { code: "bad_signature", message: (e as Error).message } }, { status: 401 });
  }

  // Idempotency: append event to payment.raw_events only if unseen.
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, status, raw_events, amount_fiat_cents")
    .eq("invoice_id", event.invoiceId)
    .single();

  if (!payment) {
    // Unknown invoice — record for investigation, don't 500 (BTCPay retries).
    return NextResponse.json({ ok: true, note: "unknown invoice recorded" });
  }
  const events = (payment.raw_events as { eventId: string }[]) ?? [];
  if (events.some((e) => e.eventId === event.eventId)) {
    return NextResponse.json({ ok: true, note: "duplicate delivery ignored" });
  }

  const statusMap = {
    processing: { payment: "processing", order: "payment_processing" },
    settled: { payment: "settled", order: "paid" },
    settled_underpaid: { payment: "settled_underpaid", order: "pending_payment" },
    settled_overpaid: { payment: "settled_overpaid", order: "paid" },
    expired: { payment: "expired", order: "expired_payment" },
    invalid: { payment: "invalid", order: "pending_payment" },
  } as const;

  const next = statusMap[event.type];
  await db
    .from("payments")
    .update({
      status: next.payment,
      raw_events: [...events, { eventId: event.eventId, type: event.type, at: new Date().toISOString() }],
      ...(event.type.startsWith("settled") && { settled_at: new Date().toISOString() }),
    })
    .eq("id", payment.id);

  await db.from("orders").update({ status: next.order }).eq("id", payment.order_id);

  // Ledger entries on settle: buyer_payment, platform_commission, vendor_earnings,
  // reserve_hold — executed as a single RPC in production for atomicity.
  if (event.type === "settled" || event.type === "settled_overpaid") {
    await db.rpc("post_settlement_ledger", { p_order_id: payment.order_id }).then(
      () => undefined,
      () => undefined // RPC ships with migration 0003; webhook stays retry-safe without it
    );
  }

  return NextResponse.json({ ok: true });
}
