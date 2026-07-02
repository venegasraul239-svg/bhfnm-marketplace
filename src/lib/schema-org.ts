// JSON-LD builders. Facts only — values come from verified structured data.

import type { Category, Faq, Product, Review, Vendor } from "./types";

const SITE = "https://buyhempflowernearme.com";
const MP = `${SITE}/marketplace`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Buy Hemp Flower Near Me Marketplace",
    url: MP,
    parentOrganization: { "@type": "Organization", name: "Buy Hemp Flower Near Me", url: SITE },
    description:
      "Compliance-first hemp marketplace with verified sellers, batch-linked COAs, tracked fulfillment, and Bitcoin checkout.",
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BHFNM Marketplace",
    url: MP,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${MP}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.href.startsWith("http") ? it.href : `${MP}${it.href}`,
    })),
  };
}

export function faqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function productSchema(p: Product, vendor: Vendor, reviews: Review[]) {
  const prices = p.variants.filter((v) => !v.wholesaleOnly).map((v) => v.priceCents / 100);
  const lowPrice = prices.length ? Math.min(...prices) : undefined;
  const highPrice = prices.length ? Math.max(...prices) : undefined;
  const inStock = p.variants.some((v) => v.stock > 0);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    url: `${MP}/product/${p.slug}`,
    image: p.images.map((i) => i.url),
    description: p.shortDescription,
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: vendor.brandName, url: `${MP}/store/${vendor.slug}` },
    ...(p.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: p.ratingAvg,
        reviewCount: p.ratingCount,
        bestRating: 5,
      },
    }),
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      reviewRating: { "@type": "Rating", ratingValue: r.ratingOverall, bestRating: 5 },
      name: r.title,
      reviewBody: r.body,
      datePublished: r.createdAt,
    })),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice,
      highPrice,
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: vendor.brandName },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingOrigin: {
          "@type": "DefinedRegion",
          addressCountry: p.shippingOrigin.country,
          addressRegion: p.shippingOrigin.region,
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: p.handlingDaysMin,
            maxValue: p.handlingDaysMax,
            unitCode: "DAY",
          },
        },
      },
    },
    additionalProperty: Object.entries(p.facts).map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value,
    })),
  };
}

export function storeSchema(v: Vendor) {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: v.brandName,
    url: `${MP}/store/${v.slug}`,
    description: v.seoDescription,
    ...(v.logoUrl && { logo: v.logoUrl }),
    address: { "@type": "PostalAddress", addressRegion: v.region, addressCountry: v.country },
    ...(v.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: v.ratingAvg,
        reviewCount: v.ratingCount,
        bestRating: 5,
      },
    }),
  };
}

export function categorySchema(c: Category, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${c.name} — BHFNM Marketplace`,
    url: `${MP}/categories/${c.slug}`,
    description: c.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${MP}/product/${p.slug}`,
        name: p.title,
      })),
    },
  };
}
