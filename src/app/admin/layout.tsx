import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Marketplace Admin",
  robots: { index: false, follow: false },
};

// Server-side guard: only profiles.role='admin' may render anything below
// /admin. RLS enforces the same boundary on every query — the guard is UX,
// the database is law.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return children;
}

export const dynamic = "force-dynamic";
