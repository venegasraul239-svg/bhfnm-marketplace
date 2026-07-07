// POST /api/messages — send a marketplace-inbox message.
// Threads are order-linked or vendor product inquiries. Every message passes
// the off-platform-contact detectors; flagged messages persist flagged for
// admin review (immutable either way).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnVendor, getProfile } from "@/lib/auth";
import { moderateMessage } from "@/lib/moderation";
import { supabaseService } from "@/lib/supabase";

const SendSchema = z.object({
  threadId: z.string().uuid().optional(),
  vendorSlug: z.string().optional(), // start a buyer→vendor inquiry
  body: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in first." } }, { status: 401 });
  }
  const db = supabaseService();
  if (!db) {
    return NextResponse.json({ error: { code: "backend_not_configured", message: "Not connected." } }, { status: 503 });
  }
  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "Malformed message." } }, { status: 400 });
  }
  const { threadId, vendorSlug, body } = parsed.data;

  const ownVendor = await getOwnVendor(db);

  // Resolve or create the thread, and verify the sender is a participant.
  let thread: { id: string; buyer_id: string | null; vendor_id: string | null } | null = null;
  if (threadId) {
    const { data } = await db.from("message_threads").select("id, buyer_id, vendor_id").eq("id", threadId).maybeSingle();
    thread = data;
    const participant =
      thread &&
      (thread.buyer_id === profile.id ||
        (ownVendor && thread.vendor_id === ownVendor.id) ||
        profile.role === "admin");
    if (!participant) {
      return NextResponse.json({ error: { code: "forbidden", message: "Not your thread." } }, { status: 403 });
    }
  } else if (vendorSlug) {
    const { data: vendor } = await db.from("vendors").select("id").eq("slug", vendorSlug).eq("status", "active").maybeSingle();
    if (!vendor) {
      return NextResponse.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });
    }
    const { data: existing } = await db
      .from("message_threads")
      .select("id, buyer_id, vendor_id")
      .eq("thread_type", "product_inquiry")
      .eq("buyer_id", profile.id)
      .eq("vendor_id", vendor.id)
      .maybeSingle();
    thread = existing;
    if (!thread) {
      const { data: created, error } = await db
        .from("message_threads")
        .insert({ thread_type: "product_inquiry", buyer_id: profile.id, vendor_id: vendor.id })
        .select("id, buyer_id, vendor_id")
        .single();
      if (error || !created) {
        return NextResponse.json({ error: { code: "persist_failed", message: "Could not start the thread." } }, { status: 500 });
      }
      thread = created;
    }
  } else {
    return NextResponse.json({ error: { code: "invalid_input", message: "threadId or vendorSlug required." } }, { status: 400 });
  }

  if (!thread) {
    return NextResponse.json({ error: { code: "not_found", message: "Thread not found." } }, { status: 404 });
  }

  const senderRole =
    profile.role === "admin" ? "admin" : ownVendor && thread.vendor_id === ownVendor.id ? "vendor" : "buyer";

  const moderation = moderateMessage(body);
  const { data: message, error } = await db
    .from("messages")
    .insert({
      thread_id: thread.id,
      sender_id: profile.id,
      sender_role: senderRole,
      body,
      flagged: moderation.flags.length > 0,
    })
    .select("id")
    .single();
  if (error || !message) {
    return NextResponse.json({ error: { code: "persist_failed", message: "Message not sent — try again." } }, { status: 500 });
  }

  for (const flag of moderation.flags) {
    await db.from("message_flags").insert({ message_id: message.id, flag_type: flag.type, matched_text: flag.match });
  }

  return NextResponse.json({
    ok: true,
    threadId: thread.id,
    warning:
      moderation.flags.length > 0
        ? "Heads up: sharing contact details or off-platform payment instructions violates marketplace policy. This message was flagged for review."
        : undefined,
  });
}
