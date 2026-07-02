// Message moderation — off-platform contact & payment-diversion detection.
// Runs server-side BEFORE a message persists; hits are stored as message_flags
// for admin review. Messages themselves are immutable once stored.

export type ModerationFlag =
  | "email_address" | "phone_number" | "wallet_address" | "telegram"
  | "whatsapp" | "discord" | "external_url" | "offplatform_payment";

const DETECTORS: [ModerationFlag, RegExp][] = [
  ["email_address", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  ["phone_number", /(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/],
  // BTC bech32 / legacy, ETH, LN invoice
  ["wallet_address", /\b(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40}|lnbc[a-z0-9]{20,})\b/],
  ["telegram", /\b(t\.me\/|telegram|tg:\s*@)/i],
  ["whatsapp", /\b(whats\s?app|wa\.me\/)/i],
  ["discord", /\b(discord(\.gg|app\.com)?)/i],
  ["external_url", /\bhttps?:\/\/(?!buyhempflowernearme\.com)[^\s]+/i],
  ["offplatform_payment", /\b(venmo|cashapp|cash app|zelle|paypal|pay\s+(me\s+)?(directly|off[\s-]?site|outside)|send\s+(btc|bitcoin|crypto)\s+to|wire\s+transfer|western union)\b/i],
];

export interface ModerationResult {
  allowed: boolean;             // messages always persist; flags drive enforcement
  flags: { type: ModerationFlag; match: string }[];
}

export function moderateMessage(body: string): ModerationResult {
  const flags: ModerationResult["flags"] = [];
  for (const [type, re] of DETECTORS) {
    const m = body.match(re);
    if (m) flags.push({ type, match: m[0].slice(0, 80) });
  }
  return { allowed: true, flags };
}

/** Enforcement ladder applied by the flags worker. */
export const ENFORCEMENT_LADDER = [
  { strikes: 1, action: "automated_warning" },
  { strikes: 2, action: "admin_review" },
  { strikes: 3, action: "listing_suspension_review" },
  { strikes: 4, action: "store_suspension_review" },
] as const;
