// POST /api/admin/products/{id}/review — approve (→ live), reject (→ delisted),
// or request changes (→ changes_requested with a field-level note).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject", "request_changes"]),
  note: z.string().max(4000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRoleApi("admin");
  if (!admin) {
    return NextResponse.json({ error: { code: "forbidden", message: "Admin role required." } }, { status: 403 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }

  const { id } = await ctx.params;
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed review." } }, { status: 400 });
  }
  const { action, note } = parsed.data;

  const { data: product } = await db
    .from("products")
    .select("id, title, status, vendor:vendors(slug, support_email, owner:profiles(email))")
    .eq("id", id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: { code: "not_found", message: "Product not found." } }, { status: 404 });
  }
  if (product.status !== "pending_review") {
    return NextResponse.json(
      { error: { code: "invalid_state", message: `Product is '${product.status}', not pending review.` } },
      { status: 409 }
    );
  }
  if (action === "request_changes" && !note) {
    return NextResponse.json(
      { error: { code: "note_required", message: "Say what needs to change." } },
      { status: 400 }
    );
  }

  const next =
    action === "approve"
      ? { status: "live", approved_by: admin.id, approved_at: new Date().toISOString(), status_note: null }
      : action === "reject"
        ? { status: "delisted", status_note: note ?? null }
        : { status: "changes_requested", status_note: note ?? null };

  const { error } = await db.from("products").update(next).eq("id", id);
  if (error) {
    console.error("[admin/products] review failed:", error.message);
    return NextResponse.json({ error: { code: "persist_failed", message: "Could not record the decision." } }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    actor_id: admin.id,
    actor_role: "admin",
    action: `product_${action}`,
    entity_type: "products",
    entity_id: id,
    after: { status: next.status, note: note ?? null },
  });

  const vendorRel = product.vendor as unknown as { owner: { email: string } | null } | null;
  const ownerEmail = vendorRel?.owner?.email;
  if (ownerEmail) {
    await sendEmail("product_review_decision", [ownerEmail], {
      product: product.title,
      decision: next.status,
      note: note ?? "",
    });
  }

  return NextResponse.json({ ok: true, status: next.status });
}
