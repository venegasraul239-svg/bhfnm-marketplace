// Shared UI primitives — shadcn-style, hand-rolled to keep the dependency
// surface small. Dark-first, accessible contrast.

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "btc";
  size?: "sm" | "md" | "lg";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-400 disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" && "px-3 py-1.5 text-sm",
    size === "md" && "px-4 py-2.5 text-sm",
    size === "lg" && "px-6 py-3 text-base",
    variant === "primary" && "bg-jade-500 text-ink-950 hover:bg-jade-400",
    variant === "secondary" && "border border-ink-600 bg-ink-800 text-mist-100 hover:border-jade-500/60 hover:bg-ink-700",
    variant === "ghost" && "text-mist-300 hover:text-mist-100 hover:bg-ink-800",
    variant === "danger" && "bg-signal-red/90 text-white hover:bg-signal-red",
    variant === "btc" && "bg-btc text-ink-950 hover:brightness-110",
    className
  );
  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button className={styles} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-surface rounded-card", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-jade-400">{eyebrow}</p>
      )}
      <h2 className="font-display text-2xl font-bold text-mist-100 sm:text-3xl text-balance">{title}</h2>
      {sub && <p className="mt-3 text-sm leading-relaxed text-mist-400 sm:text-base">{sub}</p>}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-mist-100 sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-mist-400">{label}</div>
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "neutral" | "info";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "ok" && "bg-jade-500/15 text-jade-300",
        tone === "warn" && "bg-amber-glow/15 text-amber-glow",
        tone === "bad" && "bg-signal-red/15 text-signal-red",
        tone === "info" && "bg-sky-500/15 text-sky-300",
        tone === "neutral" && "bg-ink-700 text-mist-300"
      )}
    >
      {children}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-mist-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-jade-300">
                {it.name}
              </Link>
            ) : (
              <span className="text-mist-300">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-ink-700 rounded-card border border-ink-700">
      {faqs.map((f, i) => (
        <details key={i} className="group px-5 py-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-mist-100 marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.q}
              <span className="text-jade-400 transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-mist-400">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-ink-600 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-mist-200">{title}</p>
      {sub && <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">{sub}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
