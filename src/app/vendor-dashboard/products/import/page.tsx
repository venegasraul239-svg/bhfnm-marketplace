// Catalog import — Shopify / WooCommerce CSV → mapped drafts.

import { DashboardShell, VENDOR_NAV } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui";
import { getOwnVendor } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const db = supabaseService();
  const vendor = await getOwnVendor(db);

  if (!db || !vendor) {
    return (
      <DashboardShell title="Import catalog" nav={VENDOR_NAV} active="/vendor-dashboard/products">
        <EmptyState title="No approved store on this account" sub="Imports unlock once your application is approved." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Import catalog" nav={VENDOR_NAV} active="/vendor-dashboard/products" badge={vendor.brand_name}>
      <p className="mb-6 max-w-3xl text-sm text-mist-400">
        Bring your Shopify or WooCommerce catalog over as private drafts. Your source categories,
        tags, and metadata rarely match marketplace taxonomy — the wizard has you map them
        explicitly, and preserves the originals on each listing. Imported drafts still need
        structured COA data and admin review before anything goes public.
      </p>
      <ImportWizard />
    </DashboardShell>
  );
}
