import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";

const POLICIES: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  "buyer-protection": {
    title: "Buyer Protection",
    sections: [
      { h: "What's covered", p: "Damaged products, wrong products, materially different products from the listing, missing items, and verified shipment failures are eligible for dispute within 48 hours of confirmed delivery." },
      { h: "What's not covered", p: "Change of mind, subjective flavor/aroma/effect expectations, failure to read listed product details, and used consumable products are not eligible for return or refund." },
      { h: "How it works", p: "Open a dispute from your order page within the 48-hour window. The seller has 48 hours to respond. Marketplace admins review evidence from both sides — tracking data, photos, batch and COA data, and message history — and issue a final decision, including full or partial refunds where warranted." },
      { h: "Payments", p: "Vendor payouts are only released after delivery is confirmed and the dispute window has passed, so refund decisions can be enforced by the platform." },
    ],
  },
  disputes: {
    title: "Dispute Policy",
    sections: [
      { h: "Windows", p: "Buyers have 48 hours after confirmed delivery to report an issue. Sellers have 48 hours to respond to an open dispute. Marketplace administration has final decision authority." },
      { h: "Evidence", p: "Disputes are decided on tracking events, product and packaging photos, COA and batch data, marketplace message history, delivery status, and seller performance history. All evidence is preserved and exportable by administrators." },
      { h: "Outcomes", p: "Possible outcomes include full refund, partial refund, refund denial, or return-required (with a platform-issued return label). Sellers found at fault may receive penalties, payout holds, reserve increases, or suspension." },
    ],
  },
  shipping: {
    title: "Shipping & Tracking",
    sections: [
      { h: "Platform labels", p: "Every order ships with a marketplace-generated label from an approved carrier. Sellers cannot substitute arbitrary tracking numbers, and an order is only marked shipped after a real carrier acceptance scan." },
      { h: "Handling times", p: "Each listing displays the seller's handling estimate. Late shipments trigger warnings and repeated delays affect seller ranking. Severely overdue unshipped orders become eligible for automatic cancellation and refund." },
      { h: "Destinations", p: "The marketplace currently serves the United States and Canada. Checkout eligibility is evaluated per destination based on product category and cannabinoid type; cross-border cannabinoid orders are not available." },
    ],
  },
  reviews: {
    title: "Review Policy",
    sections: [
      { h: "Verified only", p: "Reviews can only be written by buyers with a completed order for the specific product. Every review carries a verified-purchase badge and remains linked to the underlying order." },
      { h: "Seller limits", p: "Sellers cannot edit, delete, hide, or suppress reviews under any circumstance." },
      { h: "Moderation", p: "Marketplace admins moderate only for abuse, spam, illegal content, threats, doxxing, or demonstrable fraud. Moderation reasons are recorded, and moderated reviews are hidden rather than deleted." },
    ],
  },
  "vendor-agreement": {
    title: "Vendor Agreement (Summary)",
    sections: [
      { h: "Verification", p: "Sellers complete business, identity, and payout-wallet verification before opening a store. Products require individual admin approval and structured, batch-linked COA data before going live." },
      { h: "Conduct", p: "All buyer communication stays in the marketplace inbox. Soliciting off-platform contact or payment, uploading misleading compliance data, or manipulating reviews results in enforcement up to suspension." },
      { h: "Payouts & reserves", p: "The default marketplace commission is 12% (adjustable per agreement). New sellers carry a rolling payout reserve that decreases with proven performance. Payouts release after delivery confirmation and the dispute window, minus any holds." },
      { h: "Fulfillment", p: "Sellers agree to marketplace-generated shipping labels, carrier acceptance-scan validation, displayed handling times, and the dispute process described in the Dispute Policy." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return {};
  return {
    title: policy.title,
    alternates: { canonical: `/marketplace/legal/${slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumbs items={[{ name: "Marketplace", href: "/" }, { name: policy.title }]} />
      <h1 className="mt-6 font-display text-3xl font-black text-mist-100">{policy.title}</h1>
      <div className="mt-8 space-y-8">
        {policy.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-lg font-bold text-mist-100">{s.h}</h2>
            <p className="mt-2 text-sm leading-relaxed text-mist-400">{s.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 rounded-card border border-ink-700 bg-ink-900/50 p-5 text-xs leading-relaxed text-mist-400">
        This page summarizes marketplace operating rules. It is not legal advice, and marketplace verification does
        not constitute a legal compliance determination for any jurisdiction.
      </p>
    </div>
  );
}
