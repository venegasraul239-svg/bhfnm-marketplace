// GET /api/search/suggest?q= — lightweight typeahead: top product and store
// matches. Anon-safe (RLS: live products / active vendors only).

import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase";
import { dataMode } from "@/lib/data";
import { PRODUCTS, VENDORS } from "@/lib/seed";

export const dynamic = "force-dynamic";

interface Suggestion {
  type: "product" | "store";
  label: string;
  sub: string;
  href: string;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const mode = dataMode();
  if (mode === "empty") return NextResponse.json({ suggestions: [] });

  if (mode === "demo") {
    const needle = q.toLowerCase();
    const suggestions: Suggestion[] = [
      ...PRODUCTS.filter((p) => p.status === "live" && p.title.toLowerCase().includes(needle))
        .slice(0, 5)
        .map((p) => ({ type: "product" as const, label: p.title, sub: p.cannabinoidType, href: `/product/${p.slug}` })),
      ...VENDORS.filter((v) => v.brandName.toLowerCase().includes(needle))
        .slice(0, 3)
        .map((v) => ({ type: "store" as const, label: v.brandName, sub: "Store", href: `/store/${v.slug}` })),
    ];
    return NextResponse.json({ suggestions });
  }

  const db = supabaseAnon()!;
  const safe = q.replace(/[%,()]/g, " ").trim();
  if (!safe) return NextResponse.json({ suggestions: [] });

  const [products, vendors] = await Promise.all([
    db
      .from("products")
      .select("slug, title, cannabinoid_type, batch_number")
      .eq("status", "live")
      .or(`title.ilike.%${safe}%,batch_number.ilike.%${safe}%`)
      .limit(5),
    db
      .from("vendors")
      .select("slug, brand_name")
      .eq("status", "active")
      .ilike("brand_name", `%${safe}%`)
      .limit(3),
  ]);

  const suggestions: Suggestion[] = [
    ...(products.data ?? []).map((p) => ({
      type: "product" as const,
      label: p.title,
      sub: p.cannabinoid_type === "none" ? "Product" : String(p.cannabinoid_type).toUpperCase(),
      href: `/product/${p.slug}`,
    })),
    ...(vendors.data ?? []).map((v) => ({
      type: "store" as const,
      label: v.brand_name,
      sub: "Store",
      href: `/store/${v.slug}`,
    })),
  ];

  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
