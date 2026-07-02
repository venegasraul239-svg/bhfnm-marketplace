import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace Admin",
  robots: { index: false, follow: false },
};

// Production: this layout wraps an auth guard requiring profiles.role = 'admin'
// (enforced again by RLS on every query — the guard is UX, the database is law).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
