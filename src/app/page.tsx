import Link from "next/link";
import { getCategories, getProducts, getVendors } from "@/lib/data";
import { Button, Card, FaqAccordion, SectionHeading, Stat } from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { BadgeRow } from "@/components/TrustBadge";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema } from "@/lib/schema-org";
import { FlaskConical, ShieldCheck, Truck, Scale, Bitcoin, Store } from "lucide-react";

export const revalidate = 600;

const HOME_FAQS = [
  { q: "What makes this marketplace different?", a: "Every seller passes identity and business verification before their store opens, every cannabinoid listing requires an admin-verified, batch-linked COA, and every order ships with a platform-generated tracked label. Products cannot go live without compliance review." },
  { q: "How do Bitcoin payments work?", a: "Checkout generates a Bitcoin invoice supporting both on-chain and Lightning payment. Your order confirms automatically when the payment settles, and the vendor is paid out only after delivery and the dispute window complete." },
  { q: "Is my purchase protected?", a: "Yes. Delivery is confirmed via carrier tracking, and you have a 48-hour window after delivery to report damaged, wrong, missing, or materially different items. Marketplace admins make the final call on disputes and can issue full or partial refunds." },
  { q: "Can any brand sell here?", a: "No. Sellers apply through a multi-step onboarding covering business registration, owner identity, compliance processes, and lab partners. Applications are manually reviewed, and products are individually approved before going live." },
  { q: "Do you ship everywhere?", a: "The marketplace currently serves the United States and Canada. Checkout eligibility is evaluated per destination based on product category and cannabinoid type. Listings stay visible for research even where checkout is restricted." },
];

export default async function HomePage() {
  const [categories, products, vendors] = await Promise.all([
    getCategories(),
    getProducts(),
    getVendors(),
  ]);
  const vendorMap = new Map(vendors.map((v) => [v.slug, v]));
  const trending = products.slice(0, 8);
  const featuredCategories = categories.filter((c) =>
    ["hemp-flower", "thca-flower", "gummies", "thc-drinks", "cbn-sleep", "wholesale"].includes(c.slug)
  );
  const wholesaleVendors = vendors.filter((v) => v.wholesaleEnabled);

  return (
    <>
      <JsonLd data={faqSchema(HOME_FAQS)} />

      {/* Hero */}
      <section className="gradient-hero border-b border-ink-800">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-jade-500/30 bg-jade-500/10 px-3 py-1 text-xs font-semibold text-jade-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Every seller verified · Every batch COA-checked
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-black leading-tight text-mist-100 sm:text-6xl text-balance">
            The compliance-first hemp marketplace
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist-300 sm:text-lg">
            Buy hemp flower, cannabinoid products, and wholesale supply from identity-verified farms, manufacturers,
            and brands — with batch-linked lab results, tracked fulfillment, and Bitcoin checkout.
          </p>

          <div className="mt-8">
            <SearchBar variant="hero" placeholder="Search verified products, brands, or batch numbers…" />
          </div>

          <div className="mt-12 grid max-w-2xl grid-cols-2 gap-8 sm:grid-cols-4">
            {vendors.length > 0 && <Stat value={`${vendors.length}`} label="Verified vendors" />}
            {products.some((p) => p.compliance) && (
              <Stat value={`${products.filter((p) => p.compliance).length}`} label="Verified COAs live" />
            )}
            <Stat value="100%" label="Tracked shipments" />
            <Stat value="₿ + ⚡" label="On-chain & Lightning" />
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Shop by category"
          title="Verified categories"
          sub="Every cannabinoid category requires structured COA data, jurisdiction rules, and 21+ verification."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredCategories.map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="card-surface group rounded-card p-6 transition-colors hover:border-jade-500/50">
              <h3 className="font-display text-lg font-bold text-mist-100 group-hover:text-jade-300">{c.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-mist-400">{c.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-jade-400">Browse →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending products — or truthful launch state */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionHeading eyebrow="Trending" title="Recently verified products" />
        {trending.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((p) => (
              <ProductCard key={p.id} product={p} vendor={vendorMap.get(p.vendorSlug)} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-card border border-dashed border-ink-600 px-6 py-14 text-center">
            <p className="font-display text-lg font-bold text-mist-100">The marketplace is launching</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-mist-400">
              Verified sellers are completing onboarding and compliance review now. Products appear
              here only after their batch-linked COAs pass admin verification — nothing is listed
              before it is checked.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button href="/vendors/apply">Apply to sell</Button>
              <Button href="https://buyhempflowernearme.com/" variant="secondary">Explore the education hub</Button>
            </div>
          </div>
        )}
      </section>

      {/* Featured brands */}
      {vendors.length > 0 && (
      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Sellers"
            title="Featured verified brands"
            sub="Best-rated stores across farms, manufacturers, and wholesale suppliers."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {vendors.map((v) => (
              <Link key={v.slug} href={`/store/${v.slug}`} className="card-surface group flex flex-col gap-3 rounded-card p-6 transition-colors hover:border-jade-500/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-mist-100 group-hover:text-jade-300">{v.brandName}</h3>
                    <p className="text-xs text-mist-400">
                      {v.city ? `${v.city}, ` : ""}{v.region}, {v.country} · ★ {v.ratingAvg.toFixed(1)} ({v.ratingCount}) · {v.productCount} products
                    </p>
                  </div>
                  <Store className="h-6 w-6 shrink-0 text-mist-400 group-hover:text-jade-400" aria-hidden />
                </div>
                <p className="line-clamp-2 text-sm text-mist-400">{v.about}</p>
                <BadgeRow badges={v.badges} max={4} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Trust pillars */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Why buy here"
          title="Built for trust, not volume"
          sub="A curated seller network with verification at every layer — not an open listing free-for-all."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Verified sellers only", body: "Multi-step onboarding: business registration, owner identity, licenses, and payout wallet ownership — reviewed by humans before a store opens." },
            { icon: FlaskConical, title: "Structured, batch-linked COAs", body: "COAs aren't PDF attachments here. Potency and safety panels are structured data, hash-verified, tied to the exact batch, and re-checked before badges appear." },
            { icon: Truck, title: "Tracked marketplace shipping", body: "Every label is platform-generated. An order only counts as shipped after a real carrier acceptance scan — no pasted tracking numbers." },
            { icon: Scale, title: "Real dispute protection", body: "48-hour post-delivery dispute window with evidence on both sides and final decisions by marketplace admins. Vendor payouts wait until delivery clears." },
          ].map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="h-6 w-6 text-jade-400" aria-hidden />
              <h3 className="mt-4 font-display text-base font-bold text-mist-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-400">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* BTC band */}
      <section className="gradient-band border-y border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-btc">
              <Bitcoin className="h-4 w-4" aria-hidden /> Bitcoin-native checkout
            </p>
            <h2 className="font-display text-2xl font-bold text-mist-100 sm:text-3xl">Pay on-chain or over Lightning</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300 sm:text-base">
              Checkout creates a self-hosted BTCPay invoice — no third-party processor. Orders confirm when payment
              settles, receipts are recorded to an internal ledger, and sellers are paid only after delivery and the
              dispute window clear.
            </p>
          </div>
          <div className="flex gap-3">
            <Button href="/legal/buyer-protection" variant="secondary">Buyer protection</Button>
            <Button href="/legal/vendor-agreement" variant="secondary">Vendor protection</Button>
          </div>
        </div>
      </section>

      {/* Wholesale strip */}
      {wholesaleVendors.length > 0 && (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="B2B"
          title="Featured wholesale suppliers"
          sub="MOQ-based bulk supply with tiered pricing from verified farms, manufacturers, and distributors."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {wholesaleVendors.map((v) => (
            <Link key={v.slug} href={`/store/${v.slug}`} className="card-surface group flex items-center justify-between gap-4 rounded-card p-5 transition-colors hover:border-jade-500/50">
              <div>
                <h3 className="font-semibold text-mist-100 group-hover:text-jade-300">{v.brandName}</h3>
                <p className="text-xs text-mist-400">{v.sellerType.replace(/_/g, " ")} · {v.region}, {v.country}{v.privateLabelEnabled ? " · Private label" : ""}</p>
              </div>
              <span className="text-sm font-semibold text-jade-400">Wholesale →</span>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Button href="/categories/wholesale" variant="secondary">Browse all wholesale listings</Button>
        </div>
      </section>
      )}

      {/* Seller CTA */}
      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-mist-100 sm:text-3xl">Sell where verification is the standard</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-400 sm:text-base">
              Farms, manufacturers, brands, distributors, and retailers: apply for a verified storefront. Onboarding
              is free — bring your business documentation, lab partners, and batch tracking process.
            </p>
          </div>
          <Button href="/vendors/apply" size="lg">Apply to sell</Button>
        </div>
      </section>

      {/* SEO block + FAQ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="About the marketplace" title="How BHFNM Marketplace works" />
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-mist-400">
              <p>
                BHFNM Marketplace is the commerce layer of{" "}
                <a href="https://buyhempflowernearme.com/" className="text-jade-300 underline">Buy Hemp Flower Near Me</a>,
                the hemp education resource covering{" "}
                <a href="https://buyhempflowernearme.com/hemp-laws-by-state/" className="text-jade-300 underline">state-by-state hemp laws</a>{" "}
                and <a href="https://buyhempflowernearme.com/how-to-read-a-hemp-coa/" className="text-jade-300 underline">COA literacy</a>.
                Sellers complete document-based verification before opening a store, and each cannabinoid listing
                publishes structured lab data: delta-9 THC, total THC, THCA, CBD and CBG percentages plus pesticide,
                heavy-metal, microbial and solvent panel statuses for the exact batch offered.
              </p>
              <p>
                Orders are single-vendor with Bitcoin and Lightning payment, platform-generated shipping labels, and a
                48-hour post-delivery dispute window. Reviews come exclusively from verified completed orders and can
                never be edited or removed by sellers.
              </p>
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="FAQ" title="Common questions" />
            <div className="mt-6">
              <FaqAccordion faqs={HOME_FAQS} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
