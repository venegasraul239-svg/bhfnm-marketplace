// Buyer account — real session profile, wholesale business profile, sign out.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { WholesaleProfileForm } from "./WholesaleProfileForm";

export const metadata: Metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/account");

  const db = supabaseService();
  const { data: wholesale } = db
    ? await db
        .from("wholesale_profiles")
        .select("company_name, business_type, resale_certificate, tax_info")
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const cert = (wholesale?.resale_certificate ?? {}) as { number?: string; state?: string };
  const tax = (wholesale?.tax_info ?? {}) as { tax_id?: string };

  return (
    <DashboardShell title="Your account" nav={BUYER_NAV} active="/account">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-surface rounded-card p-6">
          <h2 className="font-semibold text-mist-100">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-mist-400">Email</dt><dd className="text-mist-200">{profile.email}</dd></div>
            <div className="flex justify-between"><dt className="text-mist-400">Role</dt><dd className="text-mist-200 capitalize">{profile.role}</dd></div>
            {profile.country && (
              <div className="flex justify-between"><dt className="text-mist-400">Destination</dt><dd className="text-mist-200">{profile.region ? `${profile.region}, ` : ""}{profile.country}</dd></div>
            )}
          </dl>
          <form action="/marketplace/api/auth/sign-out" method="post" className="mt-5">
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>

        <div className="card-surface rounded-card p-6">
          <h2 className="font-semibold text-mist-100">Wholesale buyer profile</h2>
          <p className="mb-4 mt-3 text-sm text-mist-400">
            Add your company details and resale certificate to request wholesale pricing from suppliers.
          </p>
          <WholesaleProfileForm
            initial={
              wholesale
                ? {
                    companyName: wholesale.company_name,
                    businessType: wholesale.business_type ?? "",
                    resaleCertificate: cert.number ?? "",
                    resaleState: cert.state ?? "",
                    taxId: tax.tax_id ?? "",
                  }
                : null
            }
          />
        </div>

        <div className="card-surface rounded-card p-6 md:col-span-2">
          <h2 className="font-semibold text-mist-100">Selling on BHFNM</h2>
          <p className="mt-3 text-sm text-mist-400">
            Any buyer account can apply for a verified storefront. Onboarding is free and document-based.
          </p>
          <div className="mt-4 flex gap-3">
            <Button href="/vendors/apply" size="sm">Apply to sell</Button>
            <Button href="/vendors/apply/status" variant="secondary" size="sm">Application status</Button>
            {profile.role === "vendor" && <Button href="/vendor-dashboard" variant="secondary" size="sm">Vendor dashboard</Button>}
            {profile.role === "admin" && <Button href="/admin" variant="secondary" size="sm">Admin console</Button>}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
