// POST /api/admin/applications/{id}/decision — approve / reject / request_info.
// Admin-only (server-verified role). Approval provisions the real vendor row,
// promotes the applicant to vendor, and assigns the default reserve tier.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

const DecisionSchema = z.object({
  action: z.enum(["approve", "reject", "request_info"]),
  reasonCode: z
    .enum(["incomplete_docs", "unverifiable_identity", "prohibited_products", "jurisdiction", "fraud_signals", "other"])
    .optional(),
  note: z.string().max(4000).optional(),
});

// Wizard seller-type labels → seller_type enum.
const SELLER_TYPE_MAP: Record<string, string> = {
  "hemp farm": "hemp_farm",
  "hemp manufacturer": "manufacturer",
  "cbd brand": "cbd_brand",
  "cbg brand": "cbg_brand",
  "thca brand": "thca_brand",
  "hemp-derived cannabinoid brand": "hd_cannabinoid_brand",
  "beverage brand": "beverage_brand",
  "wellness brand": "wellness_brand",
  "accessory retailer": "accessory_retailer",
  distributor: "distributor",
  wholesaler: "wholesaler",
  "retail store": "retail_store",
  "private-label brand": "private_label",
  "approved dropshipper": "dropshipper",
  "approved reseller": "reseller",
};

const HIGH_RISK_TYPES = new Set(["thca_brand", "hd_cannabinoid_brand", "dropshipper", "reseller"]);

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRoleApi("admin");
  if (!admin) {
    return NextResponse.json({ error: { code: "forbidden", message: "Admin role required." } }, { status: 403 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }

  const { id } = await ctx.params;
  const parsed = DecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed decision." } }, { status: 400 });
  }
  const { action, reasonCode, note } = parsed.data;

  const { data: app } = await db
    .from("vendor_applications")
    .select("id, applicant_id, status, steps")
    .eq("id", id)
    .maybeSingle();
  if (!app) {
    return NextResponse.json({ error: { code: "not_found", message: "Application not found." } }, { status: 404 });
  }
  if (!["submitted", "resubmitted", "under_review", "info_requested"].includes(app.status)) {
    return NextResponse.json(
      { error: { code: "invalid_state", message: `Cannot decide an application in state '${app.status}'.` } },
      { status: 409 }
    );
  }

  const { data: applicant } = await db
    .from("profiles")
    .select("id, email, role")
    .eq("id", app.applicant_id)
    .single();

  const steps = (app.steps ?? {}) as Record<string, Record<string, string | boolean>>;
  const s0 = steps["0"] ?? {};
  const s1 = steps["1"] ?? {};
  const s2 = steps["2"] ?? {};

  async function audit(action_: string, after: Record<string, unknown>) {
    await db!.from("audit_logs").insert({
      actor_id: admin!.id,
      actor_role: "admin",
      action: action_,
      entity_type: "vendor_applications",
      entity_id: id,
      after,
    });
  }

  // ---------------------------------------------------------------- request info
  if (action === "request_info") {
    if (!note) {
      return NextResponse.json(
        { error: { code: "note_required", message: "Explain what information is needed." } },
        { status: 400 }
      );
    }
    await db.from("vendor_applications").update({ status: "info_requested" }).eq("id", id);

    let { data: thread } = await db.from("message_threads").select("id").eq("application_id", id).maybeSingle();
    if (!thread) {
      const { data: created } = await db
        .from("message_threads")
        .insert({ thread_type: "application", application_id: id, buyer_id: app.applicant_id })
        .select("id")
        .single();
      thread = created;
    }
    if (thread) {
      await db.from("messages").insert({
        thread_id: thread.id,
        sender_id: admin.id,
        sender_role: "admin",
        body: note,
      });
    }
    await audit("application_info_requested", { note });
    if (applicant) await sendEmail("vendor_application_info_requested", [applicant.email], { note });
    return NextResponse.json({ ok: true, status: "info_requested" });
  }

  // ---------------------------------------------------------------- reject
  if (action === "reject") {
    if (!reasonCode) {
      return NextResponse.json(
        { error: { code: "reason_required", message: "Rejections require a reason code." } },
        { status: 400 }
      );
    }
    await db
      .from("vendor_applications")
      .update({
        status: "rejected",
        reason_code: reasonCode,
        reason_note: note ?? null,
        decided_at: new Date().toISOString(),
        decided_by: admin.id,
      })
      .eq("id", id);
    await audit("application_rejected", { reasonCode, note });
    if (applicant) await sendEmail("vendor_application_rejected", [applicant.email], { reasonCode, note: note ?? "" });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // ---------------------------------------------------------------- approve
  const brandName = String(s2.brandName ?? s0.company ?? "").trim();
  if (!brandName) {
    return NextResponse.json(
      { error: { code: "incomplete", message: "Application lacks a brand name — request info instead." } },
      { status: 422 }
    );
  }

  // Reserve a unique slug from the requested one.
  const base = slugify(String(s2.slug ?? brandName)) || `store-${id.slice(0, 6)}`;
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const { data: clash } = await db.from("vendors").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const sellerType = SELLER_TYPE_MAP[String(s0.sellerType ?? "").toLowerCase()] ?? "cbd_brand";

  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .insert({
      owner_id: app.applicant_id,
      application_id: id,
      slug,
      brand_name: brandName,
      seller_type: sellerType,
      legal_business_name: String(s1.legalName ?? "") || null,
      dba_name: String(s1.dba ?? "") || null,
      country: String(s0.country ?? "US"),
      region: String(s0.region ?? "") || null,
      shipping_origin: { country: String(s0.country ?? "US"), region: String(s2.shippingOrigin ?? s0.region ?? "") },
      about: String(s2.about ?? "") || null,
      seo_description: String(s2.seoDescription ?? "") || null,
      support_email: String(s2.supportEmail ?? "") || null,
      support_phone: String(s2.supportPhone ?? "") || null,
      support_hours: String(s2.supportHours ?? "") || null,
      website: String(s0.website ?? "") || null,
      wholesale_enabled: Boolean(s2.wholesale),
      private_label_enabled: Boolean(s2.privateLabel),
      payout_wallet: String(s1.walletAddress ?? "") || null,
      // Verification flags stay false until document review confirms them.
    })
    .select("id, slug")
    .single();

  if (vendorError || !vendor) {
    console.error("[decision] vendor provisioning failed:", vendorError?.message);
    return NextResponse.json(
      { error: { code: "provision_failed", message: "Vendor creation failed — check application data." } },
      { status: 500 }
    );
  }

  // Default reserve tier (high-risk seller types get the larger reserve).
  const highRisk = HIGH_RISK_TYPES.has(sellerType);
  await db.from("vendor_reserves").insert({
    vendor_id: vendor.id,
    reserve_pct: highRisk ? 0.25 : 0.15,
    rolling_days: highRisk ? 45 : 30,
    risk_tier: highRisk ? 2 : 1,
    notes: "Default tier assigned at approval",
    updated_by: admin.id,
  });

  // Promote the applicant (admins keep their admin role).
  if (applicant && applicant.role === "buyer") {
    await db.from("profiles").update({ role: "vendor" }).eq("id", app.applicant_id);
  }

  await db
    .from("vendor_applications")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: admin.id })
    .eq("id", id);

  await audit("application_approved", { vendorId: vendor.id, slug: vendor.slug, highRisk });
  if (applicant) {
    await sendEmail("vendor_application_approved", [applicant.email], {
      storefront: `https://buyhempflowernearme.com/marketplace/store/${vendor.slug}`,
    });
  }

  return NextResponse.json({ ok: true, status: "approved", vendorId: vendor.id, slug: vendor.slug });
}
