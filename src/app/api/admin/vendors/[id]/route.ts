// POST /api/admin/vendors/{id} — superadmin store controls:
// suspend/reinstate, commission override, reserve tier. All actions audited.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

const ControlSchema = z.object({
  action: z.enum(["suspend", "reinstate", "set_commission", "set_reserve"]),
  reason: z.string().max(1000).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
  reservePct: z.number().min(0).max(0.9).optional(),
  rollingDays: z.number().int().min(0).max(365).optional(),
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
  const parsed = ControlSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed control action." } }, { status: 400 });
  }
  const { action, reason, commissionRate, reservePct, rollingDays } = parsed.data;

  const { data: vendor } = await db.from("vendors").select("id, status, brand_name").eq("id", id).maybeSingle();
  if (!vendor) {
    return NextResponse.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });
  }

  async function audit(after: Record<string, unknown>) {
    await db!.from("audit_logs").insert({
      actor_id: admin!.id,
      actor_role: "admin",
      action: `vendor_${action}`,
      entity_type: "vendors",
      entity_id: id,
      after,
    });
  }

  if (action === "suspend" || action === "reinstate") {
    const status = action === "suspend" ? "suspended" : "active";
    const { error } = await db
      .from("vendors")
      .update({ status, suspended_reason: action === "suspend" ? (reason ?? "Suspended by admin") : null })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: { code: "persist_failed", message: "Could not update store status." } }, { status: 500 });
    }
    // Suspension pulls the catalog: live products go to suspended; reinstate restores them.
    if (action === "suspend") {
      await db.from("products").update({ status: "suspended" }).eq("vendor_id", id).eq("status", "live");
    } else {
      await db.from("products").update({ status: "live" }).eq("vendor_id", id).eq("status", "suspended");
    }
    await audit({ status, reason });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "set_commission") {
    if (commissionRate === undefined) {
      return NextResponse.json({ error: { code: "rate_required", message: "commissionRate required." } }, { status: 400 });
    }
    const { error } = await db.from("commission_rules").insert({
      scope: "vendor",
      vendor_id: id,
      rate: commissionRate,
      created_by: admin.id,
    });
    if (error) {
      return NextResponse.json({ error: { code: "persist_failed", message: "Could not set commission." } }, { status: 500 });
    }
    await audit({ commissionRate });
    return NextResponse.json({ ok: true, commissionRate });
  }

  // set_reserve
  if (reservePct === undefined && rollingDays === undefined) {
    return NextResponse.json({ error: { code: "values_required", message: "reservePct or rollingDays required." } }, { status: 400 });
  }
  const { error } = await db.from("vendor_reserves").upsert(
    {
      vendor_id: id,
      ...(reservePct !== undefined && { reserve_pct: reservePct }),
      ...(rollingDays !== undefined && { rolling_days: rollingDays }),
      notes: reason ?? "Adjusted by admin",
      updated_by: admin.id,
    },
    { onConflict: "vendor_id" }
  );
  if (error) {
    return NextResponse.json({ error: { code: "persist_failed", message: "Could not set reserve." } }, { status: 500 });
  }
  await audit({ reservePct, rollingDays });
  return NextResponse.json({ ok: true });
}
