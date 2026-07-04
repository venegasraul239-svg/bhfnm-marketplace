// Admin overview — live queue counts from the database. Zeros are zeros.

import Link from "next/link";
import { ADMIN_NAV, DashboardShell, StatCards } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const db = supabaseService();
  if (!db) {
    return (
      <DashboardShell title="Marketplace admin" nav={ADMIN_NAV} active="/admin">
        <EmptyState title="Backend not connected" sub="Configure Supabase to activate the admin console." />
      </DashboardShell>
    );
  }

  const count = async (table: string, filter: (q: any) => any) => {
    const { count: c } = await filter(db.from(table).select("id", { count: "exact", head: true }));
    return c ?? 0;
  };

  const [apps, products, coas, orders, disputes, payoutsQueued, flags] = await Promise.all([
    count("vendor_applications", (q) => q.in("status", ["submitted", "resubmitted", "under_review"])),
    count("products", (q) => q.eq("status", "pending_review")),
    count("compliance_records", (q) => q.eq("status", "submitted")),
    count("orders", (q) => q.in("status", ["paid", "accepted", "label_created", "shipped"])),
    count("disputes", (q) => q.not("status", "in", "(resolved,closed)")),
    count("payouts", (q) => q.eq("status", "queued")),
    count("fraud_flags", (q) => q.is("resolved_at", null)),
  ]);

  const queues = [
    { label: "Vendor applications", value: apps, href: "/admin/vendors" },
    { label: "Products awaiting review", value: products, href: "/admin/products" },
    { label: "COAs awaiting verification", value: coas, href: "/admin/compliance" },
    { label: "Active orders", value: orders, href: "/admin/orders" },
    { label: "Open disputes", value: disputes, href: "/admin/disputes" },
    { label: "Payouts queued", value: payoutsQueued, href: "/admin/payouts" },
    { label: "Unresolved fraud flags", value: flags, href: "/admin/reports" },
  ];

  return (
    <DashboardShell title="Marketplace admin" nav={ADMIN_NAV} active="/admin">
      <StatCards
        items={[
          { label: "Review queues", value: String(apps + products + coas), tone: apps + products + coas ? "warn" : "ok" },
          { label: "Active orders", value: String(orders) },
          { label: "Open disputes", value: String(disputes), tone: disputes ? "bad" : "ok" },
          { label: "Fraud flags", value: String(flags), tone: flags ? "bad" : "ok" },
        ]}
      />
      <h2 className="mb-3 mt-10 font-display text-lg font-bold text-mist-100">Work queues</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {queues.map((q) => (
          <li key={q.label}>
            <Link href={q.href} className="card-surface flex items-center justify-between rounded-card px-5 py-4 text-sm transition-colors hover:border-jade-500/50">
              <span className="text-mist-200">{q.label}</span>
              <span className={`font-display text-lg font-bold ${q.value ? "text-amber-glow" : "text-mist-400"}`}>{q.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
