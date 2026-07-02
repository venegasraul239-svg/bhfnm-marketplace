import type { Metadata } from "next";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <DashboardShell title="Your account" nav={BUYER_NAV} active="/account">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-surface rounded-card p-6">
          <h2 className="font-semibold text-mist-100">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-mist-400">Email</dt><dd className="text-mist-200">demo-buyer@example.com</dd></div>
            <div className="flex justify-between"><dt className="text-mist-400">Destination</dt><dd className="text-mist-200">United States · NC</dd></div>
            <div className="flex justify-between"><dt className="text-mist-400">Age verification</dt><dd className="text-jade-300">Confirmed 21+</dd></div>
          </dl>
        </div>
        <div className="card-surface rounded-card p-6">
          <h2 className="font-semibold text-mist-100">Wholesale buyer profile</h2>
          <p className="mt-3 text-sm text-mist-400">
            Add your company details and resale certificate to request wholesale pricing from suppliers.
          </p>
          <div className="mt-4"><Button variant="secondary" size="sm">Set up business profile</Button></div>
        </div>
        <div className="card-surface rounded-card p-6 md:col-span-2">
          <h2 className="font-semibold text-mist-100">Selling on BHFNM</h2>
          <p className="mt-3 text-sm text-mist-400">
            Any buyer account can apply for a verified storefront. Onboarding is free and document-based.
          </p>
          <div className="mt-4"><Button href="/vendors/apply" size="sm">Apply to sell</Button></div>
        </div>
      </div>
    </DashboardShell>
  );
}
