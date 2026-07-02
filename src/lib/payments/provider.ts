// Payment abstraction layer. BTCPay is the launch provider; future methods
// implement the same port. No provider == checkout disabled — never simulated.

export interface CreateInvoiceInput {
  orderId: string;
  amountFiatCents: number;
  currency: string;           // "USD" | "CAD"
  buyerEmail?: string;
  redirectUrl: string;
}

export interface Invoice {
  invoiceId: string;
  checkoutLink: string;
  expiresAt: string;
}

export type PaymentEventType =
  | "processing" | "settled" | "expired" | "invalid"
  | "settled_underpaid" | "settled_overpaid";

export interface PaymentEvent {
  eventId: string;
  invoiceId: string;
  orderId: string;
  type: PaymentEventType;
  amountReceivedBtc?: number;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  /** Verify webhook signature and normalize the event. Throws on bad signature. */
  parseWebhook(rawBody: string, signatureHeader: string | null): PaymentEvent;
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("Bitcoin payments are not configured on this environment. Checkout is disabled — no payment is simulated.");
    this.name = "PaymentsNotConfiguredError";
  }
}
