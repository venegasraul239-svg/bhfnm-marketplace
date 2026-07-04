// POST /api/checkout — turns the buyer's cart for ONE vendor into a real
// pending-payment order plus a real BTCPay invoice.
//
// Identity comes from the session; items come from the server-side cart;
// nothing is trusted from the client except vendor selection, destination,
// and an idempotency key. There is NO simulated-success path anywhere.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { evaluateCheckoutEligibility } from "@/lib/jurisdiction";
import { BtcPayProvider, getBtcPayConfig } from "@/lib/payments/btcpay";
import { supabaseService } from "@/lib/supabase";
import type { Product } from "@/lib/types";
// (Product type used for row typing below)

const CheckoutSchema = z.object({
  vendorSlug: z.string().min(1),
  destination: z.object({ country: z.string().length(2), region: z.string().optional() }),
  idempotencyKey: z.string().min(8).max(80),
});

interface CartItemRow {
  quantity: number;
  variant: {
    id: string; name: string; price_cents: number; stock: number;
    product: {
      id: string; slug: string; title: string; status: string;
      cannabinoid_type: Product["cannabinoidType"]; age_restricted: boolean;
      restricted_jurisdictions: { country: string; region?: string }[] | null;
      shipping_origin: { country?: string; region?: string } | null;
      category: { slug: string } | null;
    } | null;
  } | null;
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in to check out." } },
      { status: 401 }
    );
  }

  const db = supabaseService();
  const btcpay = getBtcPayConfig();
  if (!db || !btcpay) {
    return NextResponse.json(
      {
        error: {
          code: "payments_not_configured",
          message:
            "Checkout is not enabled on this environment. Bitcoin payments require a configured BTCPay Server and database — no payment is ever simulated.",
        },
      },
      { status: 503 }
    );
  }

  const parsed = CheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed checkout request." } }, { status: 400 });
  }
  const { vendorSlug, destination, idempotencyKey } = parsed.data;

  // Idempotency: same key → same order/invoice (no duplicates on retry/double-click).
  const { data: existingOrder } = await db
    .from("orders")
    .select("id, order_number, payment:payments(checkout_link, expires_at)")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
    .then(
      (r) => r,
      () => ({ data: null }) // idempotency_key column absent until migration 0003 — degrade gracefully
    );
  if (existingOrder) {
    const payment = (existingOrder.payment as unknown as { checkout_link: string; expires_at: string }[] | null)?.[0];
    return NextResponse.json({
      orderId: existingOrder.id,
      orderNumber: existingOrder.order_number,
      checkoutLink: payment?.checkout_link,
      expiresAt: payment?.expires_at,
      reused: true,
    });
  }

  const { data: vendor } = await db
    .from("vendors")
    .select("id, slug, status")
    .eq("slug", vendorSlug)
    .maybeSingle();
  if (!vendor || vendor.status !== "active") {
    return NextResponse.json({ error: { code: "vendor_unavailable", message: "This store is not available." } }, { status: 409 });
  }

  // Server-side cart is the source of truth for items.
  const { data: cart } = await db
    .from("carts")
    .select(
      `id, items:cart_items(quantity, variant:product_variants(id, name, price_cents, stock,
         product:products(id, slug, title, status, cannabinoid_type, age_restricted,
           restricted_jurisdictions, shipping_origin, category:categories(slug))))`
    )
    .eq("buyer_id", profile.id)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  const items = ((cart?.items ?? []) as unknown as CartItemRow[]).filter((i) => i.variant && i.variant.product);
  if (!cart || items.length === 0) {
    return NextResponse.json({ error: { code: "empty_cart", message: "Your cart for this store is empty." } }, { status: 400 });
  }

  // Re-validate every line: live status, stock, destination eligibility.
  let subtotalCents = 0;
  for (const item of items) {
    const v = item.variant!;
    const p = v.product!;
    if (p.status !== "live") {
      return NextResponse.json(
        { error: { code: "unavailable", message: `${p.title} is no longer available.` } },
        { status: 409 }
      );
    }
    if (v.stock < item.quantity) {
      return NextResponse.json(
        { error: { code: "out_of_stock", message: `Insufficient stock for ${p.title} (${v.stock} left).` } },
        { status: 409 }
      );
    }
    const decision = evaluateCheckoutEligibility(
      {
        cannabinoidType: p.cannabinoid_type,
        ageRestricted: p.age_restricted,
        restrictedJurisdictions: p.restricted_jurisdictions ?? [],
        shippingOrigin: {
          country: p.shipping_origin?.country ?? "US",
          region: p.shipping_origin?.region ?? "",
        },
      },
      destination
    );
    if (!decision.eligible) {
      return NextResponse.json(
        { error: { code: "destination_restricted", message: decision.notice ?? `${p.title} cannot ship to your destination.` } },
        { status: 409 }
      );
    }
    subtotalCents += v.price_cents * item.quantity;
  }

  // Commission snapshot: vendor override → platform default (12%).
  const { data: rule } = await db
    .from("commission_rules")
    .select("rate")
    .eq("scope", "vendor")
    .eq("vendor_id", vendor.id)
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const commissionRate = rule ? Number(rule.rate) : 0.12;

  const orderInsert = {
    buyer_id: profile.id,
    vendor_id: vendor.id,
    status: "pending_payment",
    subtotal_cents: subtotalCents,
    total_cents: subtotalCents,
    commission_rate: commissionRate,
    commission_cents: Math.round(subtotalCents * commissionRate),
    destination,
    eligibility_snapshot: { checkedAt: new Date().toISOString(), destination },
  };

  let order: { id: string; order_number: string } | null = null;
  {
    const withKey = await db
      .from("orders")
      .insert({ ...orderInsert, idempotency_key: idempotencyKey })
      .select("id, order_number")
      .single();
    if (withKey.error && /idempotency_key/.test(withKey.error.message)) {
      // Migration 0003 not applied yet — retry without the column.
      const fallback = await db.from("orders").insert(orderInsert).select("id, order_number").single();
      order = fallback.data;
      if (fallback.error) console.error("[checkout] order insert failed:", fallback.error.message);
    } else {
      order = withKey.data;
      if (withKey.error) console.error("[checkout] order insert failed:", withKey.error.message);
    }
  }
  if (!order) {
    return NextResponse.json({ error: { code: "order_failed", message: "Order creation failed." } }, { status: 500 });
  }

  await db.from("order_items").insert(
    items.map((i) => ({
      order_id: order!.id,
      product_id: i.variant!.product!.id,
      variant_id: i.variant!.id,
      title: i.variant!.product!.title,
      variant_name: i.variant!.name,
      quantity: i.quantity,
      unit_price_cents: i.variant!.price_cents,
    }))
  );

  let invoice;
  try {
    invoice = await new BtcPayProvider().createInvoice({
      orderId: order.id,
      amountFiatCents: subtotalCents,
      currency: "USD",
      buyerEmail: profile.email,
      redirectUrl: `https://buyhempflowernearme.com/marketplace/orders/${order.id}`,
    });
  } catch (e) {
    console.error("[checkout] BTCPay invoice failed:", e);
    await db.from("orders").update({ status: "cancelled", cancelled_reason: "invoice_creation_failed" }).eq("id", order.id);
    return NextResponse.json(
      { error: { code: "invoice_failed", message: "The payment server could not create an invoice. Nothing was charged — please try again." } },
      { status: 502 }
    );
  }

  await db.from("payments").insert({
    order_id: order.id,
    invoice_id: invoice.invoiceId,
    checkout_link: invoice.checkoutLink,
    amount_fiat_cents: subtotalCents,
    expires_at: invoice.expiresAt,
  });

  // Cart served its purpose.
  await db.from("cart_items").delete().eq("cart_id", cart.id);

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.order_number,
    checkoutLink: invoice.checkoutLink,
    expiresAt: invoice.expiresAt,
  });
}
