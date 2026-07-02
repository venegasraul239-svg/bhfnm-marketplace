import Link from "next/link";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Marketplace",
    links: [
      { label: "Hemp Flower", href: "/categories/hemp-flower" },
      { label: "CBD Flower", href: "/categories/cbd-flower" },
      { label: "THCA Flower", href: "/categories/thca-flower" },
      { label: "Gummies & Edibles", href: "/categories/gummies" },
      { label: "THC Drinks", href: "/categories/thc-drinks" },
      { label: "Wholesale", href: "/categories/wholesale" },
    ],
  },
  {
    title: "Sellers",
    links: [
      { label: "Apply to sell", href: "/vendors/apply" },
      { label: "Vendor dashboard", href: "/vendor-dashboard" },
      { label: "Farm Direct", href: "/categories/farm-direct" },
      { label: "Manufacturer Direct", href: "/categories/manufacturer-direct" },
    ],
  },
  {
    title: "Trust & policies",
    links: [
      { label: "Buyer protection", href: "/legal/buyer-protection" },
      { label: "Dispute policy", href: "/legal/disputes" },
      { label: "Shipping & tracking", href: "/legal/shipping" },
      { label: "Review policy", href: "/legal/reviews" },
      { label: "Vendor agreement", href: "/legal/vendor-agreement" },
    ],
  },
  {
    title: "Education hub",
    links: [
      { label: "How to read a hemp COA", href: "https://buyhempflowernearme.com/how-to-read-a-hemp-coa/" },
      { label: "Hemp laws by state", href: "https://buyhempflowernearme.com/hemp-laws-by-state/" },
      { label: "Wholesale research", href: "https://buyhempflowernearme.com/wholesale-hemp-flower/" },
      { label: "Buy Hemp Flower Near Me", href: "https://buyhempflowernearme.com/" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-800 bg-ink-900/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jade-500 font-display text-base font-black text-ink-950">B</span>
            <span className="font-display text-sm font-bold text-mist-100">BHFNM Marketplace</span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-mist-400">
            A curated, compliance-first hemp marketplace. Every seller is identity-verified, every cannabinoid
            listing carries a batch-linked COA, and every order ships with platform-tracked labels.
          </p>
        </div>
        {COLS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-300">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} className="text-sm text-mist-400 hover:text-jade-300">{l.label}</a>
                  ) : (
                    <Link href={l.href} className="text-sm text-mist-400 hover:text-jade-300">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-ink-800">
        <div className="mx-auto max-w-7xl px-4 py-6 text-[11px] leading-relaxed text-mist-400 sm:px-6">
          <p>
            For adults 21+. Product availability varies by destination and is enforced at checkout. Marketplace
            verification reflects our document and COA review process; it is not legal advice. Consult the{" "}
            <a href="https://buyhempflowernearme.com/hemp-laws-by-state/" className="underline hover:text-jade-300">
              state-by-state guides
            </a>{" "}
            for educational information about hemp laws.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Buy Hemp Flower Near Me. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
