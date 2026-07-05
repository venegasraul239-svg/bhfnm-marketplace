// POST /api/vendor/uploads — vendor product-image upload to Supabase Storage.
// multipart/form-data with a single "file" field. Returns the public URL.
// Scoped to the vendor's own folder; type/size validated server-side.

import { NextResponse } from "next/server";
import { getOwnVendor, requireRoleApi } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  const profile = await requireRoleApi("vendor", "admin");
  if (!profile) {
    return NextResponse.json({ error: { code: "forbidden", message: "Vendor account required." } }, { status: 403 });
  }
  const db = supabaseService();
  const vendor = await getOwnVendor(db);
  if (!db || !vendor) {
    return NextResponse.json({ error: { code: "no_store", message: "No approved store on this account." } }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: "no_file", message: "Attach an image file." } }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: { code: "bad_type", message: "Use JPEG, PNG, WebP, or AVIF images." } },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "too_large", message: "Images must be 5 MB or smaller." } },
      { status: 413 }
    );
  }

  const path = `${vendor.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await db.storage.from("product-images").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[uploads] storage upload failed:", error.message);
    return NextResponse.json(
      { error: { code: "upload_failed", message: "Upload failed — try again." } },
      { status: 500 }
    );
  }

  const { data } = db.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
