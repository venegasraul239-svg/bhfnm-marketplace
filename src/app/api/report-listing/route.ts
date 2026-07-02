// POST /api/report-listing — public listing-issue reports → compliance queue.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";

const ReportSchema = z.object({
  product: z.string().min(1),
  reason: z.enum(["coa_issue", "wrong_data", "counterfeit", "policy_violation", "other"]),
  details: z.string().min(5).max(5000),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const parsed = ReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Invalid report." } }, { status: 400 });
  }

  const db = supabaseService();
  if (db) {
    await db.from("listing_reports").insert({
      product_id: parsed.data.product, // slug→uuid resolution in production
      reporter_email: parsed.data.email || null,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
  }
  // Accept even without a backend so reporters aren't discouraged in preview;
  // preview reports are logged server-side only.
  console.info("[listing-report]", JSON.stringify(parsed.data));
  return NextResponse.json({ ok: true });
}
