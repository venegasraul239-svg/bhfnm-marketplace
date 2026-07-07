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
        html: renderHtml(event, data),
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

function escapeHtml(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

/** Minimal branded HTML — table-based for broad client support. */
function renderHtml(event: EmailEvent, data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5c6d66;font-size:13px;text-transform:capitalize;white-space:nowrap">${escapeHtml(
          k.replace(/([A-Z])/g, " $1")
        )}</td><td style="padding:6px 0;color:#0f1c17;font-size:13px;word-break:break-word">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f9f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td style="padding-bottom:18px">
  <span style="display:inline-block;width:32px;height:32px;border-radius:8px;background:#059669;color:#ffffff;text-align:center;line-height:32px;font-weight:700;font-size:16px">B</span>
  <span style="font-weight:700;color:#0f1c17;font-size:15px;padding-left:8px">BHFNM Marketplace</span>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #dbe4e0;border-radius:14px;padding:28px">
  <h1 style="margin:0 0 14px;font-size:19px;color:#0f1c17">${escapeHtml(SUBJECTS[event])}</h1>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${rows}</table>
  <p style="margin:22px 0 0"><a href="https://buyhempflowernearme.com/marketplace/account" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:9px">Open your account</a></p>
</td></tr>
<tr><td style="padding-top:16px;color:#8aa39a;font-size:12px;line-height:1.6">
  Sent by BHFNM Marketplace · <a href="https://buyhempflowernearme.com/marketplace" style="color:#059669">buyhempflowernearme.com/marketplace</a><br>
  This mailbox is not monitored — reply via your marketplace inbox.
</td></tr>
</table></td></tr></table></body></html>`;
}
