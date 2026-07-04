// Buyer wholesale/business profile — persists ONLY to the authenticated
// buyer's own row (wholesale_profiles PK = profile id).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

const ProfileSchema = z.object({
  companyName: z.string().min(2).max(160),
  businessType: z.string().max(80).optional(),
  resaleCertificate: z.string().max(120).optional(),
  resaleState: z.string().max(40).optional(),
  taxId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in first." } }, { status: 401 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }

  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid profile." } },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { error } = await db.from("wholesale_profiles").upsert(
    {
      profile_id: profile.id, // always the session user — never client-supplied
      company_name: input.companyName,
      business_type: input.businessType ?? null,
      resale_certificate:
        input.resaleCertificate || input.resaleState
          ? { number: input.resaleCertificate ?? null, state: input.resaleState ?? null }
          : null,
      tax_info: input.taxId ? { tax_id: input.taxId } : null,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    console.error("[wholesale-profile] upsert failed:", error.message);
    return NextResponse.json({ error: { code: "persist_failed", message: "Could not save the profile." } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
