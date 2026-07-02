import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Dashboard",
  robots: { index: false, follow: false },
};

export default function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
