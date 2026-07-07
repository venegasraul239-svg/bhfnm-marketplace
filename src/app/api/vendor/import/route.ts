// Vendor catalog import (Shopify / WooCommerce CSV).
// POST multipart {file}            → preview: parsed rows + distinct source categories
// POST json {rows, defaultNote}    → commit: create DRAFT products (never live)
// Publication still requires structured COA data + admin review per listing.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnVendor, requireRoleApi } from "@/lib/auth";
import { detectFormat, normalize, parseCsv } from "@/lib/import";
import { supabaseService } from "@/lib/supabase";

const MAX_ROWS = 200;

const CommitSchema = z.object({
  rows: z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        description: z.string().max(8000).optional(),
        shortDescription: z.string().max(300).optional(),
        categorySlug: z.string().min(1),
        cannabinoidType: z.enum(["cbd", "cbg", "cbn", "thca", "delta9_hemp", "delta8", "hhc", "mixed", "none"]),
        sku: z.string().min(1).max(60),
        variantName: z.string().min(1).max(60),
        priceCents: z.number().int().min(0),
        stock: z.number().int().min(0),
        imageUrl: z.string().optional(),
        tags: z.array(z.string().max(60)).max(30),
        sourceCategory: z.string().max(120),
        sourceHandle: z.string().max(160),
      })
    )
    .min(1)
    .max(MAX_ROWS),
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
  if (!db || !vendor || vendor.status !== "active") {
    return NextResponse.json({ error: { code: "no_store", message: "No active store on this account." } }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ---------------------------------------------------------------- preview
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "no_file", message: "Attach a CSV export." } }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: { code: "too_large", message: "CSV must be under 4 MB." } }, { status: 413 });
    }
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) {
      return NextResponse.json({ error: { code: "empty", message: "No product rows found in that file." } }, { status: 422 });
    }
    const format = detectFormat(grid[0]);
    if (!format) {
      return NextResponse.json(
        { error: { code: "unknown_format", message: "Couldn't recognize this as a Shopify or WooCommerce product export." } },
        { status: 422 }
      );
    }
    const rows = normalize(format, grid).slice(0, MAX_ROWS);
    const categories = [...new Set(rows.map((r) => r.sourceCategory))].sort();
    return NextResponse.json({ ok: true, format, rows, categories, truncated: grid.length - 1 > MAX_ROWS });
  }

  // ---------------------------------------------------------------- commit
  const parsed = CommitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid import payload." } },
      { status: 400 }
    );
  }

  const { data: cats } = await db.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  const results: { title: string; ok: boolean; reason?: string }[] = [];
  for (const row of parsed.data.rows) {
    const categoryId = catMap.get(row.categorySlug);
    if (!categoryId) {
      results.push({ title: row.title, ok: false, reason: "unmapped category" });
      continue;
    }
    const base = slugify(row.title) || "listing";
    let slug = `${base}-${vendor.slug}`.slice(0, 90);
    for (let i = 2; i < 20; i++) {
      const { data: clash } = await db.from("products").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${vendor.slug}-${i}`.slice(0, 90);
    }
    const { data: product, error } = await db
      .from("products")
      .insert({
        vendor_id: vendor.id,
        category_id: categoryId,
        slug,
        title: row.title,
        description: row.description ?? null,
        short_description: row.shortDescription ?? null,
        cannabinoid_type: row.cannabinoidType,
        shipping_origin: vendor.shipping_origin,
        handling_days_min: vendor.handling_days_min,
        handling_days_max: vendor.handling_days_max,
        age_restricted: row.cannabinoidType !== "none",
        status: "draft",
        status_note: null,
        // Provenance + source taxonomy preserved for search facts and audit.
        search_facts: {
          imported_from: row.sourceHandle,
          source_category: row.sourceCategory,
          ...(row.tags.length && { tags: row.tags.join(", ") }),
        },
      })
      .select("id")
      .single();
    if (error || !product) {
      results.push({ title: row.title, ok: false, reason: "insert failed" });
      continue;
    }
    await db.from("product_variants").insert({
      product_id: product.id,
      sku: row.sku,
      name: row.variantName,
      price_cents: row.priceCents,
      stock: row.stock,
    });
    if (row.imageUrl && /^https?:\/\//.test(row.imageUrl)) {
      await db.from("product_images").insert({ product_id: product.id, url: row.imageUrl, alt: row.title, sort: 0 });
    }
    results.push({ title: row.title, ok: true });
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, created, failed: results.length - created, results });
}
