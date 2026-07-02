import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getCategory, getProducts, getVendors } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs, Button, FaqAccordion, SectionHeading } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, categorySchema, faqSchema } from "@/lib/schema-org";

export const revalidate = 600;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return {
    title: `${category.name} — Verified Sellers & Batch-Linked COAs`,
    description: `${category.description} Shop ${category.name.toLowerCase()} from verified sellers on BHFNM Marketplace with structured lab data and tracked shipping.`,
    alternates: { canonical: `/marketplace/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, products, vendors, allCategories] = await Promise.all([
    getCategory(slug),
    getProducts({ category: slug }),
    getVendors(),
    getCategories(),
  ]);
  if (!category) notFound();

  const vendorMap = new Map(vendors.map((v) => [v.slug, v]));
  const related = allCategories.filter((c) => c.slug !== slug).slice(0, 6);
  const crumbs = [
    { name: "Marketplace", href: "/" },
    { name: "Categories", href: "/categories" },
    { name: category.name },
  ];

  return (
    <>
      <JsonLd
        data={[
          categorySchema(category, products),
          breadcrumbSchema(crumbs.map((c) => ({ name: c.name, href: c.href ?? `/categories/${slug}` }))),
          ...(category.faqs?.length ? [faqSchema(category.faqs)] : []),
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-black text-mist-100 sm:text-4xl">{category.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-mist-400 sm:text-base">{category.seoIntro ?? category.description}</p>
          {category.jurisdictionSensitive && (
            <p className="mt-4 inline-block rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-3 py-2 text-xs text-amber-glow">
              Checkout availability for this category varies by destination and is enforced automatically. Listings
              remain visible everywhere for research.
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Filters — server-rendered facet links; live faceting ships with Meilisearch wiring */}
          <aside className="hidden lg:block" aria-label="Filters">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Filter</h2>
            <div className="mt-4 space-y-5 text-sm">
              {[
                { label: "Verification", options: ["Verified COA", "Identity Verified Seller", "Batch Linked"] },
                { label: "Seller type", options: ["Farm Direct", "Manufacturer Direct", "Brand", "Wholesaler"] },
                { label: "Ships from", options: ["United States", "Canada"] },
                { label: "Availability", options: ["In stock", "Wholesale", "Private label"] },
              ].map((g) => (
                <div key={g.label}>
                  <h3 className="mb-2 font-medium text-mist-200">{g.label}</h3>
                  <ul className="space-y-1.5 text-mist-400">
                    {g.options.map((o) => (
                      <li key={o}>
                        <label className="flex cursor-pointer items-center gap-2 hover:text-mist-200">
                          <input type="checkbox" className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 accent-jade-500" />
                          {o}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-mist-400">{products.length} verified listing{products.length === 1 ? "" : "s"}</p>
              <select aria-label="Sort" className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-mist-200">
                <option>Best match</option>
                <option>Highest rated</option>
                <option>Price: low to high</option>
                <option>Price: high to low</option>
                <option>Newest</option>
              </select>
            </div>
            {products.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} vendor={vendorMap.get(p.vendorSlug)} />
                ))}
              </div>
            ) : (
              <div className="rounded-card border border-dashed border-ink-600 p-12 text-center text-sm text-mist-400">
                No live listings in this category yet. Verified sellers are being onboarded.
              </div>
            )}
          </div>
        </div>

        {/* Compliance explainer */}
        <section className="mt-16 rounded-card border border-ink-700 bg-ink-900/50 p-8">
          <SectionHeading
            eyebrow="Compliance"
            title={`How ${category.name.toLowerCase()} listings are verified`}
            sub="Sellers upload the certificate of analysis for the exact batch offered. Our compliance team cross-checks the file against structured potency and safety data, verifies the lab, and only then grants the Verified COA badge. Expired COAs automatically lose badges and ranking."
          />
        </section>

        {category.faqs && category.faqs.length > 0 && (
          <section className="mt-12">
            <SectionHeading eyebrow="FAQ" title={`${category.name} questions`} />
            <div className="mt-6 max-w-3xl">
              <FaqAccordion faqs={category.faqs} />
            </div>
          </section>
        )}

        {/* Related */}
        <section className="mt-12 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Related categories</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {related.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} className="inline-block rounded-full border border-ink-600 px-3 py-1.5 text-sm text-mist-300 hover:border-jade-500/50 hover:text-jade-300">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {category.relatedGuides && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Buyer guides & legal info</h2>
              <ul className="mt-4 space-y-2">
                {category.relatedGuides.map((g) => (
                  <li key={g.href}>
                    <a href={g.href} className="text-sm text-jade-300 underline hover:text-jade-400">{g.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Vendor CTA */}
        <section className="mt-16 flex flex-col items-start justify-between gap-4 rounded-card border border-jade-500/25 bg-jade-500/5 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-mist-100">Sell {category.name.toLowerCase()} on BHFNM</h2>
            <p className="mt-1 text-sm text-mist-400">Verified sellers get an SEO-optimized storefront, BTC payouts, and buyer trust built in.</p>
          </div>
          <Button href="/vendors/apply">Apply to sell</Button>
        </section>
      </div>
    </>
  );
}
