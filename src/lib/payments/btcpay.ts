// BTCPay Server adapter (Greenfield API). On-chain + Lightning are configured
// store-side in BTCPay; the invoice checkout exposes both to the buyer.

import { createHmac, timingSafeEqual } from "crypto";
import type { CreateInvoiceInput, Invoice, PaymentEvent, PaymentEventType, PaymentProvider } from "./provider";
import { PaymentsNotConfiguredError } from "./provider";

interface BtcPayConfig {
  url: string;
  apiKey: string;
  storeId: string;
  webhookSecret: string;
}

export function getBtcPayConfig(): BtcPayConfig | null {
  const { BTCPAY_URL, BTCPAY_API_KEY, BTCPAY_STORE_ID, BTCPAY_WEBHOOK_SECRET } = process.env;
  if (!BTCPAY_URL || !BTCPAY_API_KEY || !BTCPAY_STORE_ID || !BTCPAY_WEBHOOK_SECRET) return null;
  return { url: BTCPAY_URL.replace(/\/$/, ""), apiKey: BTCPAY_API_KEY, storeId: BTCPAY_STORE_ID, webhookSecret: BTCPAY_WEBHOOK_SECRET };
}

const EVENT_MAP: Record<string, PaymentEventType> = {
  InvoiceProcessing: "processing",
  InvoiceSettled: "settled",
  InvoiceExpired: "expired",
  InvoiceInvalid: "invalid",
};

export class BtcPayProvider implements PaymentProvider {
  readonly name = "btcpay";
  private cfg: BtcPayConfig;

  constructor(cfg?: BtcPayConfig) {
    const resolved = cfg ?? getBtcPayConfig();
    if (!resolved) throw new PaymentsNotConfiguredError();
    this.cfg = resolved;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const res = await fetch(`${this.cfg.url}/api/v1/stores/${this.cfg.storeId}/invoices`, {
      method: "POST",
      headers: {
        Authorization: `token ${this.cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: (input.amountFiatCents / 100).toFixed(2),
        currency: input.currency,
        metadata: { orderId: input.orderId, buyerEmail: input.buyerEmail },
        checkout: {
          expirationMinutes: 15,
          redirectURL: input.redirectUrl,
          speedPolicy: "MediumSpeed",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BTCPay invoice creation failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as { id: string; checkoutLink: string; expirationTime: string };
    return { invoiceId: data.id, checkoutLink: data.checkoutLink, expiresAt: data.expirationTime };
  }

  parseWebhook(rawBody: string, signatureHeader: string | null): PaymentEvent {
    if (!signatureHeader) throw new Error("Missing BTCPay-Sig header");
    const expected = "sha256=" + createHmac("sha256", this.cfg.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid BTCPay webhook signature");
    }

    const payload = JSON.parse(rawBody) as {
      deliveryId: string;
      type: string;
      invoiceId: string;
      metadata?: { orderId?: string };
      overPaid?: boolean;
      partiallyPaid?: boolean;
    };

    let type = EVENT_MAP[payload.type];
    if (!type) throw new Error(`Unhandled BTCPay event type: ${payload.type}`);
    if (type === "settled" && payload.overPaid) type = "settled_overpaid";
    if (type === "settled" && payload.partiallyPaid) type = "settled_underpaid";

    return {
      eventId: payload.deliveryId,
      invoiceId: payload.invoiceId,
      orderId: payload.metadata?.orderId ?? "",
      type,
      raw: payload,
    };
  }
}
