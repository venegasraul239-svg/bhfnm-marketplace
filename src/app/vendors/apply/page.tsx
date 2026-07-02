import type { Metadata } from "next";
import { ApplyWizard } from "./ApplyWizard";

export const metadata: Metadata = {
  title: "Apply to Sell — Verified Seller Onboarding",
  description:
    "Apply for a verified storefront on BHFNM Marketplace. Free onboarding for hemp farms, manufacturers, brands, distributors, wholesalers, and retailers — with document-based verification.",
  alternates: { canonical: "/marketplace/vendors/apply" },
};

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-jade-400">Seller onboarding</p>
        <h1 className="mt-2 font-display text-3xl font-black text-mist-100 sm:text-4xl">Apply to sell on BHFNM Marketplace</h1>
        <p className="mt-4 text-sm leading-relaxed text-mist-400 sm:text-base">
          Onboarding is free and document-based. Your application saves automatically at every step — you can leave
          and resume anytime. Applications are reviewed by humans, typically within 3–5 business days.
        </p>
      </div>
      <ApplyWizard />
    </div>
  );
}
