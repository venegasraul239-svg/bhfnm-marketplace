// POST /api/vendor/applications — persists an application (autosave or submit).
// Requires Supabase; without it, the client keeps the draft locally and shows
// a clear message (no pretend acceptance).

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";

const ApplicationSchema = z.object({
  steps: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.boolean()]))),
  submittedAt: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = ApplicationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed application payload." } }, { status: 400 });
  }

  const db = supabaseService();
  if (!db) {
    return NextResponse.json(
      {
        error: {
          code: "backend_not_configured",
          message:
            "Application intake is not connected on this environment. Your draft is saved in your browser — submission will work once the marketplace backend is live.",
        },
      },
      { status: 503 }
    );
  }

  const { error } = await db.from("vendor_applications").insert({
    applicant_id: null, // resolved from auth session in production
    status: parsed.data.submittedAt ? "submitted" : "draft",
    steps: parsed.data.steps,
    submitted_at: parsed.data.submittedAt ?? null,
  });

  if (error) {
    return NextResponse.json({ error: { code: "persist_failed", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
