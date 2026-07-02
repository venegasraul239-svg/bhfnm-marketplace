import Link from "next/link";
import type { ReactNode } from "react";
import { supabaseConfigured } from "@/lib/data";

export function DashboardShell({
  title,
  nav,
  active,
  children,
  badge,
}: {
  title: string;
  nav: { label: string; href: string }[];
  active: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-black text-mist-100">{title}</h1>
        {badge && (
          <span className="rounded-full bg-jade-500/15 px-2.5 py-0.5 text-xs font-semibold text-jade-300">{badge}</span>
        )}
      </div>

      {!supabaseConfigured && (
        <p className="mt-4 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-xs leading-relaxed text-amber-glow">
          Preview environment: no backend connected. The rows below are demonstration data showing the production
          workflow — sign-in, live data, and actions activate once Supabase credentials are configured.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[210px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={`${title} sections`}>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                n.href === active
                  ? "bg-jade-500/15 text-jade-300"
                  : "text-mist-400 hover:bg-ink-800 hover:text-mist-200"
              }`}
              aria-current={n.href === active ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export const VENDOR_NAV = [
  { label: "Overview", href: "/vendor-dashboard" },
  { label: "Products", href: "/vendor-dashboard/products" },
  { label: "Orders", href: "/vendor-dashboard/orders" },
  { label: "Compliance", href: "/vendor-dashboard/compliance" },
  { label: "Payouts", href: "/vendor-dashboard/payouts" },
  { label: "Messages", href: "/vendor-dashboard/messages" },
  { label: "Wholesale", href: "/vendor-dashboard/wholesale" },
];

export const ADMIN_NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Vendors", href: "/admin/vendors" },
  { label: "Products", href: "/admin/products" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Reports", href: "/admin/reports" },
];

export const BUYER_NAV = [
  { label: "Account", href: "/account" },
  { label: "Orders", href: "/orders" },
  { label: "Messages", href: "/messages" },
  { label: "Disputes", href: "/disputes" },
];

export function QueueTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-ink-700">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-900/60 text-left text-xs uppercase tracking-wider text-mist-400">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-ink-800/40">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-3 text-mist-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCards({ items }: { items: { label: string; value: string; tone?: "ok" | "warn" | "bad" }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="card-surface rounded-card p-5">
          <p className="text-xs uppercase tracking-wider text-mist-400">{s.label}</p>
          <p
            className={`mt-2 font-display text-2xl font-bold ${
              s.tone === "warn" ? "text-amber-glow" : s.tone === "bad" ? "text-signal-red" : "text-mist-100"
            }`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
