// Vendor application intake.
// POST  — autosave or submit; applicant identity comes ONLY from the session.
// GET   — the caller's own application (status page).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/email";

const ApplicationSchema = z.object({
  steps: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.boolean()]))),
  submit: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = ApplicationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Malformed application payload." } },
      { status: 400 }
    );
  }

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json(
      {
        error: {
          code: "unauthenticated",
          message: "Sign in to save or submit your application. Your draft is kept in this browser meanwhile.",
        },
      },
      { status: 401 }
    );
  }

  const db = supabaseService();
  if (!db) {
    return NextResponse.json(
      { error: { code: "backend_not_configured", message: "Application intake is not connected on this environment." } },
      { status: 503 }
    );
  }

  // One active (draft/info_requested) application per applicant.
  const { data: existing } = await db
    .from("vendor_applications")
    .select("id, status")
    .eq("applicant_id", profile.id)
    .in("status", ["draft", "info_requested", "submitted", "resubmitted", "under_review"])
    .maybeSingle();

  const submitting = Boolean(parsed.data.submit);

  if (existing && ["submitted", "resubmitted", "under_review"].includes(existing.status)) {
    return NextResponse.json(
      { error: { code: "already_submitted", message: "Your application is already in review. Track it on the status page." } },
      { status: 409 }
    );
  }

  const payload = {
    applicant_id: profile.id,
    steps: parsed.data.steps,
    ...(submitting
      ? {
          status: existing?.status === "info_requested" ? "resubmitted" : "submitted",
          submitted_at: new Date().toISOString(),
        }
      : { status: "draft" as const }),
  };

  const query = existing
    ? db.from("vendor_applications").update(payload).eq("id", existing.id).select("id, status").single()
    : db.from("vendor_applications").insert(payload).select("id, status").single();

  const { data, error } = await query;
  if (error || !data) {
    // Never leak raw database errors to the browser.
    console.error("[applications] persist failed:", error?.message);
    return NextResponse.json(
      { error: { code: "persist_failed", message: "We could not save your application. Please try again." } },
      { status: 500 }
    );
  }

  if (submitting) {
    await notifyAdmins("vendor_application_submitted", {
      applicationId: data.id,
      applicantEmail: profile.email,
    });
  }

  return NextResponse.json({ ok: true, id: data.id, status: data.status });
}

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in first." } }, { status: 401 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }
  const { data } = await db
    .from("vendor_applications")
    .select("id, status, steps, reason_code, reason_note, submitted_at, decided_at, created_at")
    .eq("applicant_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ application: data ?? null });
}
