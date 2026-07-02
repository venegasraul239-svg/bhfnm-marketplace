import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/data";
import { getBtcPayConfig } from "@/lib/payments/btcpay";

export function GET() {
  return NextResponse.json({
    ok: true,
    services: {
      database: supabaseConfigured ? "configured" : "seed-fallback",
      payments: getBtcPayConfig() ? "configured" : "disabled",
    },
  });
}
