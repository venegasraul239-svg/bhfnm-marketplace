import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Vendor Dashboard",
  robots: { index: false, follow: false },
};

// Server-side guard: approved vendors (and admins, for support) only.
export default async function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole("vendor", "admin");
  return children;
}

export const dynamic = "force-dynamic";
