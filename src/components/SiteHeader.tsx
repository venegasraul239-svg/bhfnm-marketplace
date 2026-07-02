import Link from "next/link";
import { Search, ShoppingBag, User } from "lucide-react";

const NAV = [
  { label: "Hemp Flower", href: "/categories/hemp-flower" },
  { label: "THCA", href: "/categories/thca-flower" },
  { label: "Edibles", href: "/categories/gummies" },
  { label: "Drinks", href: "/categories/thc-drinks" },
  { label: "Wholesale", href: "/categories/wholesale" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jade-500 font-display text-base font-black text-ink-950">
            B
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-sm font-bold text-mist-100">BHFNM Marketplace</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-mist-400">Compliance-first hemp commerce</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Categories">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-mist-300 hover:text-jade-300">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form action="/search" className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Search products, brands, batches…"
              aria-label="Search marketplace"
              className="w-64 rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-3 text-sm text-mist-100 placeholder:text-mist-400 focus:border-jade-500 focus:outline-none"
            />
          </form>
          <Link
            href="/vendors/apply"
            className="hidden rounded-lg border border-jade-500/50 px-3 py-2 text-sm font-semibold text-jade-300 hover:bg-jade-500/10 sm:block"
          >
            Sell on BHFNM
          </Link>
          <Link href="/account" aria-label="Account" className="rounded-lg p-2 text-mist-300 hover:bg-ink-800 hover:text-mist-100">
            <User className="h-5 w-5" />
          </Link>
          <Link href="/orders" aria-label="Orders" className="rounded-lg p-2 text-mist-300 hover:bg-ink-800 hover:text-mist-100">
            <ShoppingBag className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <div className="border-t border-ink-800 bg-ink-900/60">
        <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-1.5 text-[11px] text-mist-400 sm:px-6">
          <span className="whitespace-nowrap">✓ Verified sellers only</span>
          <span className="whitespace-nowrap">✓ Batch-linked COAs</span>
          <span className="whitespace-nowrap">✓ Tracked marketplace shipping</span>
          <span className="whitespace-nowrap text-btc">₿ Bitcoin &amp; Lightning checkout</span>
          <a href="https://buyhempflowernearme.com/" className="ml-auto whitespace-nowrap hover:text-jade-300">
            ← Back to education hub
          </a>
        </div>
      </div>
    </header>
  );
}
