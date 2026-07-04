// Transactional email abstraction. Resend is the first adapter.
//
// TRUTHFULNESS: when RESEND_API_KEY / EMAIL_FROM are absent, every send is a
// structured console log and nothing else — no mail is ever attempted, and
// callers never fail because email is unconfigured.

type EmailEvent =
  | "vendor_application_submitted"
  | "vendor_application_info_requested"
  | "vendor_application_approved"
  | "vendor_application_rejected"
  | "product_review_decision"
  | "payment_received"
  | "order_status_update"
  | "dispute_opened"
  | "review_request";

const SUBJECTS: Record<EmailEvent, string> = {
  vendor_application_submitted: "New vendor application submitted",
  vendor_application_info_requested: "Your BHFNM application needs more information",
  vendor_application_approved: "Your BHFNM storefront is approved",
  vendor_application_rejected: "Update on your BHFNM vendor application",
  product_review_decision: "Product review decision",
  payment_received: "Payment received for your order",
  order_status_update: "Your order status changed",
  dispute_opened: "A dispute was opened",
  review_request: "How was your order?",
};

interface SendResult {
  sent: boolean;
  reason?: string;
}

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(
  event: EmailEvent,
  to: string[],
  data: Record<string, unknown>
): Promise<SendResult> {
  if (!to.length) return { sent: false, reason: "no recipients" };
  if (!configured()) {
    console.log(`[email:noop] ${event} → ${to.join(", ")}`, JSON.stringify(data));
    return { sent: false, reason: "provider not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject: SUBJECTS[event],
        text: renderText(event, data),
      }),
    });
    if (!res.ok) {
      console.error(`[email] ${event} failed: ${res.status} ${await res.text()}`);
      return { sent: false, reason: `provider ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error(`[email] ${event} error:`, e);
    return { sent: false, reason: "network error" };
  }
}

export async function notifyAdmins(event: EmailEvent, data: Record<string, unknown>) {
  const admins = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return sendEmail(event, admins, data);
}

function renderText(event: EmailEvent, data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${String(v)}`);
  return `${SUBJECTS[event]}\n\n${lines.join("\n")}\n\n— BHFNM Marketplace\nhttps://buyhempflowernearme.com/marketplace`;
}
