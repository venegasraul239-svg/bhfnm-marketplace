// Vendor product drafts.
// POST — create or update a draft (vendor-owned; status is server-forced:
//        drafts stay drafts, `submit: true` moves to pending_review).
// Vendors can NEVER set live/approved states from this route.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnVendor, requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/email";

const DraftSchema = z.object({
  id: z.string().uuid().optional(),          // update when present
  title: z.string().min(3).max(160),
  categorySlug: z.string().min(1),
  subtype: z.string().max(80).optional(),
  description: z.string().max(8000).optional(),
  shortDescription: z.string().max(300).optional(),
  cannabinoidType: z.enum(["cbd", "cbg", "cbn", "thca", "delta9_hemp", "delta8", "hhc", "mixed", "none"]),
  batchNumber: z.string().max(60).optional(),
  imageUrl: z.string().url().optional(),
  variant: z.object({
    sku: z.string().min(1).max(60),
    name: z.string().min(1).max(60),
    priceCents: z.number().int().positive(),
    stock: z.number().int().min(0),
  }),
  wholesaleAvailable: z.boolean().optional(),
  compliance: z
    .object({
      labName: z.string().min(2).max(120),
      coaIssueDate: z.string(),
      retestDate: z.string().optional(),
      delta9ThcPct: z.number().min(0).max(100).optional(),
      totalThcPct: z.number().min(0).max(100).optional(),
      thcaPct: z.number().min(0).max(100).optional(),
      cbdPct: z.number().min(0).max(100).optional(),
      cbgPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
  submit: z.boolean().optional(),
});

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function POST(req: Request) {
  const profile = await requireRoleApi("vendor", "admin");
  if (!profile) {
    return NextResponse.json({ error: { code: "forbidden", message: "Vendor account required." } }, { status: 403 });
  }
  const db = supabaseService();
  const vendor = await getOwnVendor(db);
  if (!db || !vendor) {
    return NextResponse.json(
      { error: { code: "no_store", message: "No approved store found for this account." } },
      { status: 403 }
    );
  }
  if (vendor.status !== "active") {
    return NextResponse.json({ error: { code: "suspended", message: "Store is not active." } }, { status: 403 });
  }

  const parsed = DraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid listing data." } },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data: category } = await db.from("categories").select("id").eq("slug", input.categorySlug).maybeSingle();
  if (!category) {
    return NextResponse.json({ error: { code: "bad_category", message: "Unknown category." } }, { status: 400 });
  }

  // Submission requires structured compliance data for cannabinoid products.
  if (input.submit && input.cannabinoidType !== "none" && !input.compliance) {
    return NextResponse.json(
      {
        error: {
          code: "compliance_required",
          message: "Cannabinoid listings need structured COA data (lab, dates, potency) before review.",
        },
      },
      { status: 422 }
    );
  }

  const productFields = {
    vendor_id: vendor.id,
    category_id: category.id,
    title: input.title,
    subtype: input.subtype ?? null,
    description: input.description ?? null,
    short_description: input.shortDescription ?? null,
    cannabinoid_type: input.cannabinoidType,
    batch_number: input.batchNumber ?? null,
    shipping_origin: vendor.shipping_origin,
    handling_days_min: vendor.handling_days_min,
    handling_days_max: vendor.handling_days_max,
    wholesale_available: Boolean(input.wholesaleAvailable),
    age_restricted: input.cannabinoidType !== "none",
    status: input.submit ? "pending_review" : "draft",
    status_note: null,
  };

  let productId = input.id ?? null;

  if (productId) {
    // Only own drafts / changes_requested can be edited; never anything live.
    const { data: existing } = await db
      .from("products")
      .select("id, status")
      .eq("id", productId)
      .eq("vendor_id", vendor.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: { code: "not_found", message: "Draft not found." } }, { status: 404 });
    }
    if (!["draft", "changes_requested"].includes(existing.status)) {
      return NextResponse.json(
        { error: { code: "locked", message: `A ${existing.status} listing cannot be edited here.` } },
        { status: 409 }
      );
    }
    const { error } = await db.from("products").update(productFields).eq("id", productId);
    if (error) {
      console.error("[vendor/products] update failed:", error.message);
      return NextResponse.json({ error: { code: "persist_failed", message: "Could not save the draft." } }, { status: 500 });
    }
  } else {
    const base = slugify(input.title) || "listing";
    let slug = `${base}-${vendor.slug}`.slice(0, 90);
    for (let i = 2; i < 20; i++) {
      const { data: clash } = await db.from("products").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${vendor.slug}-${i}`.slice(0, 90);
    }
    const { data: created, error } = await db
      .from("products")
      .insert({ ...productFields, slug })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[vendor/products] insert failed:", error?.message);
      return NextResponse.json({ error: { code: "persist_failed", message: "Could not create the draft." } }, { status: 500 });
    }
    productId = created.id;
  }

  // Variant upsert (single-variant beta flow).
  await db.from("product_variants").upsert(
    {
      product_id: productId,
      sku: input.variant.sku,
      name: input.variant.name,
      price_cents: input.variant.priceCents,
      stock: input.variant.stock,
    },
    { onConflict: "product_id,sku" }
  );

  if (input.imageUrl) {
    await db.from("product_images").upsert(
      { product_id: productId, url: input.imageUrl, alt: input.title, sort: 0 },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  if (input.compliance && input.batchNumber) {
    // Placeholder path marks a metadata-only record until file upload ships;
    // admin verification still gates every badge.
    await db.from("compliance_records").insert({
      product_id: productId,
      batch_number: input.batchNumber,
      coa_storage_path: "pending-upload",
      coa_file_hash: "pending-upload",
      lab_name: input.compliance.labName,
      coa_issue_date: input.compliance.coaIssueDate,
      retest_date: input.compliance.retestDate ?? null,
      delta9_thc_pct: input.compliance.delta9ThcPct ?? null,
      total_thc_pct: input.compliance.totalThcPct ?? null,
      thca_pct: input.compliance.thcaPct ?? null,
      cbd_pct: input.compliance.cbdPct ?? null,
      cbg_pct: input.compliance.cbgPct ?? null,
    });
  }

  if (input.submit) {
    await notifyAdmins("product_review_decision", { productId, vendor: vendor.slug, event: "submitted_for_review" });
  }

  return NextResponse.json({ ok: true, id: productId, status: productFields.status });
}
