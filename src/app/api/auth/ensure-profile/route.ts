// POST /api/auth/ensure-profile — idempotent profile creation for the
// authenticated user (also promotes configured admin emails). Safe to call
// repeatedly; no-op without a session.

import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";

export async function POST() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, role: profile.role });
}
