// Vendor-scoped carts (one cart per buyer×vendor — mixed-vendor checkout is
// structurally impossible).
// GET    — the buyer's carts with items.
// POST   — add/update an item (quantity 0 removes it). Auth required.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

const ItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(0).max(999),
});

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in to view your cart." } }, { status: 401 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }

  const { data: carts } = await db
    .from("carts")
    .select(
      `id, vendor:vendors(slug, brand_name),
       items:cart_items(id, quantity, variant:product_variants(id, name, price_cents, stock,
         product:products(slug, title, status)))`
    )
    .eq("buyer_id", profile.id);

  return NextResponse.json({ carts: carts ?? [] });
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in to add items to a cart." } },
      { status: 401 }
    );
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }

  const parsed = ItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Invalid cart item." } }, { status: 400 });
  }
  const { variantId, quantity } = parsed.data;

  // Resolve variant → live product → vendor (server truth, not client payload).
  const { data: variant } = await db
    .from("product_variants")
    .select("id, stock, product:products(id, status, vendor_id)")
    .eq("id", variantId)
    .maybeSingle();
  const product = variant?.product as unknown as { id: string; status: string; vendor_id: string } | null;
  if (!variant || !product || product.status !== "live") {
    return NextResponse.json(
      { error: { code: "unavailable", message: "This product is not currently available." } },
      { status: 409 }
    );
  }
  if (quantity > 0 && variant.stock < quantity) {
    return NextResponse.json(
      { error: { code: "out_of_stock", message: `Only ${variant.stock} in stock.` } },
      { status: 409 }
    );
  }

  // Find-or-create the (buyer, vendor) cart.
  const { data: cart } = await db
    .from("carts")
    .upsert({ buyer_id: profile.id, vendor_id: product.vendor_id }, { onConflict: "buyer_id,vendor_id" })
    .select("id")
    .single();
  if (!cart) {
    return NextResponse.json({ error: { code: "persist_failed", message: "Could not open a cart." } }, { status: 500 });
  }

  if (quantity === 0) {
    await db.from("cart_items").delete().eq("cart_id", cart.id).eq("variant_id", variantId);
  } else {
    await db
      .from("cart_items")
      .upsert({ cart_id: cart.id, variant_id: variantId, quantity }, { onConflict: "cart_id,variant_id" });
  }

  return NextResponse.json({ ok: true, cartId: cart.id });
}
