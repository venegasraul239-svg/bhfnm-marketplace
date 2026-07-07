import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProducts, getReviews, getVendor, getVendors } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Breadcrumbs, Button, FaqAccordion, SectionHeading, Stat, StatusPill } from "@/components/ui";
import { BadgeRow } from "@/components/TrustBadge";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema, storeSchema } from "@/lib/schema-org";
import { MessageSquare, ShieldCheck, Star } from "lucide-react";

export const revalidate = 600;

export async function generateStaticParams() {
  const vendors = await getVendors();
  return vendors.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendor(slug);
  if (!vendor) return {};
  return {
    title: `${vendor.brandName} — Verified ${vendor.sellerType.replace(/_/g, " ")}`,
    description: vendor.seoDescription,
    alternates: { canonical: `/marketplace/store/${vendor.slug}` },
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await getVendor(slug);
  if (!vendor) notFound();

  const [products, reviews, categories] = await Promise.all([
    getProducts({ vendor: slug }),
    getReviews({ vendor: slug }),
    getCategories(),
  ]);
  const soldCategories = categories.filter((c) => products.some((p) => p.categorySlug === c.slug));
  const crumbs = [
    { name: "Marketplace", href: "/" },
    { name: "Stores", href: "/" },
    { name: vendor.brandName },
  ];
  const verificationComplete = vendor.identityVerified && vendor.businessVerified;

  return (
    <>
      <JsonLd
        data={[
          storeSchema(vendor),
          breadcrumbSchema(crumbs.map((c) => ({ name: c.name, href: c.href ?? `/store/${slug}` }))),
          ...(vendor.faqs?.length ? [faqSchema(vendor.faqs)] : []),
        ]}
      />

      {/* Store hero */}
      <section className="gradient-hero border-b border-ink-800">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <Breadcrumbs items={crumbs} />
          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-jade-500/15 font-display text-2xl font-black text-jade-300">
                {vendor.brandName[0]}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-3xl font-black text-mist-100">{vendor.brandName}</h1>
                  {verificationComplete && (
                    <StatusPill tone="ok"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified seller</StatusPill>
                  )}
                </div>
                <p className="mt-1 text-sm text-mist-400">
                  {vendor.sellerType.replace(/_/g, " ")} · {vendor.city ? `${vendor.city}, ` : ""}{vendor.region}, {vendor.country} · Joined {formatDate(vendor.joinedAt)}
                </p>
                <div className="mt-3"><BadgeRow badges={vendor.badges} size="sm" /></div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button href={`/messages?vendor=${vendor.slug}`} variant="secondary">
                <MessageSquare className="h-4 w-4" aria-hidden /> Contact via marketplace inbox
              </Button>
              {vendor.wholesaleEnabled && <Button href="/categories/wholesale">Wholesale inquiry</Button>}
            </div>
          </div>

          {/* Only metrics backed by real records render — never fabricated stats. */}
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Stat value={String(products.length)} label="Live products" />
            {vendor.ratingCount > 0 && (
              <Stat value={`★ ${vendor.ratingAvg.toFixed(1)}`} label={`${vendor.ratingCount} reviews`} />
            )}
            {vendor.onTimeShipRate > 0 && (
              <Stat value={`${Math.round(vendor.onTimeShipRate * 100)}%`} label="On-time shipping" />
            )}
            {vendor.responseHours > 0 && <Stat value={`~${vendor.responseHours}h`} label="Response time" />}
            <Stat value={`${vendor.handlingDaysMin}–${vendor.handlingDaysMax}d`} label="Handling time" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* About */}
        <section className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <SectionHeading eyebrow="About" title={`About ${vendor.brandName}`} />
            <p className="mt-5 text-sm leading-relaxed text-mist-300">{vendor.about}</p>
            {vendor.brandStory && <p className="mt-4 text-sm leading-relaxed text-mist-400">{vendor.brandStory}</p>}
            {soldCategories.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Categories sold</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {soldCategories.map((c) => (
                    <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border border-ink-600 px-3 py-1.5 text-sm text-mist-300 hover:border-jade-500/50 hover:text-jade-300">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Facts panel — AI-readable store facts */}
          <aside className="card-surface h-fit rounded-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Store facts</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Seller type", vendor.sellerType.replace(/_/g, " ")],
                ["Location", `${vendor.region}, ${vendor.country}`],
                ["Identity verified", vendor.identityVerified ? "Yes" : "Pending"],
                ["Business verified", vendor.businessVerified ? "Yes" : "Pending"],
                ["Payout wallet verified", vendor.walletVerified ? "Yes" : "Pending"],
                ["Wholesale", vendor.wholesaleEnabled ? "Available (approval required)" : "Not offered"],
                ["Private label", vendor.privateLabelEnabled ? "Available" : "Not offered"],
                ["Member since", formatDate(vendor.joinedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4">
                  <dt className="text-mist-400">{k}</dt>
                  <dd className="text-right font-medium text-mist-100">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>

        {/* Catalog */}
        <section className="mt-14">
          <SectionHeading eyebrow="Catalog" title={`Products from ${vendor.brandName}`} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} vendor={vendor} />)}
          </div>
          {products.length === 0 && <p className="mt-4 text-sm text-mist-400">No live listings yet.</p>}
        </section>

        {/* Policies */}
        <section className="mt-14">
          <SectionHeading eyebrow="Policies" title="Store policies" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {([
              ["Shipping", vendor.policies.shipping],
              ["Returns & disputes", vendor.policies.returns],
              ["Support", vendor.policies.support],
            ] as const).map(([title, body]) => (
              <div key={title} className="card-surface rounded-card p-5">
                <h3 className="text-sm font-semibold text-mist-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-14">
          <SectionHeading eyebrow="Reputation" title={`Customer reviews (${reviews.length})`} sub="All reviews come from verified completed orders and cannot be edited or removed by the seller." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <article key={r.id} className="card-surface rounded-card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1" aria-label={`${r.ratingOverall} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.ratingOverall ? "fill-amber-glow text-amber-glow" : "text-ink-600"}`} aria-hidden />
                    ))}
                  </span>
                  <StatusPill tone="ok">Verified purchase</StatusPill>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-mist-100">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{r.body}</p>
                <p className="mt-3 text-xs text-mist-400">{r.author} · {formatDate(r.createdAt)} · on <Link href={`/product/${r.productSlug}`} className="text-jade-300 underline">this product</Link></p>
              </article>
            ))}
          </div>
        </section>

        {vendor.faqs && vendor.faqs.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <SectionHeading eyebrow="Seller FAQ" title={`${vendor.brandName} FAQ`} />
            <div className="mt-6"><FaqAccordion faqs={vendor.faqs} /></div>
          </section>
        )}

        {/* SEO block */}
        <section className="mt-14 rounded-card border border-ink-700 bg-ink-900/40 p-8 text-sm leading-relaxed text-mist-400">
          <p>{vendor.seoDescription}</p>
          <p className="mt-3">
            All communication with {vendor.brandName} happens through the marketplace inbox, and every order ships
            with platform-generated tracking. Learn about hemp regulations in your area on the{" "}
            <a href="https://buyhempflowernearme.com/hemp-laws-by-state/" className="text-jade-300 underline">state-by-state legal hub</a>.
          </p>
        </section>
      </div>
    </>
  );
}
