// POST /api/admin/compliance/{id}/verify — verify or reject a COA record.
// Verification is what unlocks Verified COA / Batch Linked badges publicly.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

const VerifySchema = z.object({
  action: z.enum(["verify", "reject"]),
  notes: z.string().max(4000).optional(),
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
  const parsed = VerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed request." } }, { status: 400 });
  }
  const { action, notes } = parsed.data;

  const { data: record } = await db
    .from("compliance_records")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!record) {
    return NextResponse.json({ error: { code: "not_found", message: "Record not found." } }, { status: 404 });
  }
  if (record.status !== "submitted") {
    return NextResponse.json(
      { error: { code: "invalid_state", message: `Record is '${record.status}', not submitted.` } },
      { status: 409 }
    );
  }

  const { error } = await db
    .from("compliance_records")
    .update({
      status: action === "verify" ? "verified" : "rejected",
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
      badge_eligible: action === "verify",
      admin_notes: notes ?? null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: { code: "persist_failed", message: "Could not record the decision." } }, { status: 500 });
  }

  await db.from("compliance_reviews").insert({
    record_id: id,
    reviewer_id: admin.id,
    action: action === "verify" ? "verified" : "rejected",
    notes: notes ?? null,
  });

  return NextResponse.json({ ok: true, status: action === "verify" ? "verified" : "rejected" });
}
