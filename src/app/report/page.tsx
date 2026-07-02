import type { Metadata } from "next";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report a listing", robots: { index: false } };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-black text-mist-100">Report a listing issue</h1>
      <p className="mt-2 text-sm text-mist-400">
        Reports go straight to the marketplace compliance team. Use this for suspected COA problems, incorrect
        cannabinoid data, counterfeit concerns, or policy violations.
      </p>
      <ReportForm productSlug={product} />
    </div>
  );
}
