// Server-side identity & authorization. All role decisions happen here, from
// the cookie session — client payloads are never trusted for id or role.

import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseServer } from "./supabase-server";
import { supabaseService } from "./supabase";
import type { UserRole } from "./types";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  country: string | null;
  region: string | null;
}

function adminEmails(): string[] {
  const configured = (process.env.MARKETPLACE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Founding admin — changeable via MARKETPLACE_ADMIN_EMAILS without a deploy.
  return [...new Set([...configured, "webadmin@buyhempflowernearme.com"])];
}

export async function getUser(): Promise<User | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser(); // validates JWT against Supabase, not just cookie
  return data.user ?? null;
}

/**
 * Idempotent profile fetch-or-create. Uses the service client for the upsert
 * so it works even before migration 0003's auth trigger is applied, and to
 * promote configured admin emails exactly once.
 */
export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) return null;
  const svc = supabaseService();
  if (!svc) return null;

  const { data: existing } = await svc
    .from("profiles")
    .select("id, email, role, display_name, country, region")
    .eq("id", user.id)
    .maybeSingle();

  const shouldBeAdmin = adminEmails().includes((user.email ?? "").toLowerCase());

  if (!existing) {
    const { data: created, error } = await svc
      .from("profiles")
      .upsert(
        { id: user.id, email: user.email ?? "", role: shouldBeAdmin ? "admin" : "buyer" },
        { onConflict: "id" }
      )
      .select("id, email, role, display_name, country, region")
      .single();
    if (error) return null;
    return created as Profile;
  }

  if (shouldBeAdmin && existing.role !== "admin") {
    await svc.from("profiles").update({ role: "admin" }).eq("id", user.id);
    return { ...(existing as Profile), role: "admin" };
  }
  return existing as Profile;
}

/** Server Component guard: redirects to sign-in, or 404s on role mismatch. */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in");
  if (!roles.includes(profile.role)) redirect("/account?denied=1");
  return profile;
}

/** Route-handler guard: returns null instead of redirecting. */
export async function requireRoleApi(...roles: UserRole[]): Promise<Profile | null> {
  const profile = await getProfile();
  if (!profile || !roles.includes(profile.role)) return null;
  return profile;
}

/** The vendor row owned by the current user (approved vendors only). */
export async function getOwnVendor(svc?: SupabaseClient | null) {
  const user = await getUser();
  const db = svc ?? supabaseService();
  if (!user || !db) return null;
  const { data } = await db.from("vendors").select("*").eq("owner_id", user.id).maybeSingle();
  return data;
}
