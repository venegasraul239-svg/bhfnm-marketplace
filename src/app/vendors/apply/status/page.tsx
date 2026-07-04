// Real application status for the signed-in applicant: current state, reason
// codes, and the admin Q&A thread. No demo rows — if there is no application,
// it says so and links back to the wizard.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase";
import { Button, StatusPill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Application status — BHFNM Marketplace",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { tone: "ok" | "warn" | "bad" | "neutral" | "info"; label: string; note: string }> = {
  draft: { tone: "neutral", label: "Draft", note: "Your application has not been submitted yet." },
  submitted: { tone: "info", label: "Submitted", note: "In the review queue. Typical review time is 3–5 business days." },
  resubmitted: { tone: "info", label: "Resubmitted", note: "Your corrections are back in the review queue." },
  under_review: { tone: "info", label: "Under review", note: "A reviewer is actively working your application." },
  info_requested: { tone: "warn", label: "Information requested", note: "The review team needs more from you — see their message below, update your application, and resubmit." },
  approved: { tone: "ok", label: "Approved", note: "Congratulations — your storefront is being provisioned. The vendor dashboard is now available." },
  rejected: { tone: "bad", label: "Rejected", note: "See the reason below. You may correct the issues and resubmit." },
};

const REASON_LABELS: Record<string, string> = {
  incomplete_docs: "Incomplete documentation",
  unverifiable_identity: "Identity could not be verified",
  prohibited_products: "Product categories not permitted",
  jurisdiction: "Jurisdiction restrictions",
  fraud_signals: "Verification signals require further review",
  other: "Other — see note",
};

export default async function ApplicationStatusPage() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/sign-in?next=/vendors/apply/status");

  const db = supabaseService();
  const { data: app } = db
    ? await db
        .from("vendor_applications")
        .select("id, status, reason_code, reason_note, submitted_at, decided_at, created_at, steps")
        .eq("applicant_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: thread } = app && db
    ? await db
        .from("message_threads")
        .select("id, messages(id, sender_role, body, created_at)")
        .eq("application_id", app.id)
        .maybeSingle()
    : { data: null };

  const meta = app ? STATUS_META[app.status] ?? STATUS_META.draft : null;
  const steps = (app?.steps ?? {}) as Record<string, Record<string, unknown>>;
  const stepNames = ["Account", "Business verification", "Store profile", "Compliance setup"];
  const missing = stepNames
    .map((name, i) => ({ name, filled: Object.keys(steps[String(i)] ?? {}).length > 0 }))
    .filter((s) => !s.filled);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-black text-mist-100">Application status</h1>

      {!app ? (
        <div className="card-surface mt-8 rounded-card p-8 text-center">
          <p className="text-sm text-mist-300">No application on file for {profile.email}.</p>
          <div className="mt-5">
            <Button href="/vendors/apply">Start your application</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="card-surface mt-8 rounded-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusPill tone={meta!.tone}>{meta!.label}</StatusPill>
              <span className="text-xs text-mist-400">
                {app.submitted_at
                  ? `Submitted ${new Date(app.submitted_at).toLocaleDateString()}`
                  : `Started ${new Date(app.created_at).toLocaleDateString()}`}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-mist-300">{meta!.note}</p>

            {app.status === "rejected" && app.reason_code && (
              <div className="mt-4 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-sm">
                <p className="font-semibold text-signal-red">{REASON_LABELS[app.reason_code] ?? app.reason_code}</p>
                {app.reason_note && <p className="mt-1 text-mist-300">{app.reason_note}</p>}
              </div>
            )}

            {missing.length > 0 && app.status === "draft" && (
              <div className="mt-4 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-sm text-amber-glow">
                Missing sections: {missing.map((m) => m.name).join(", ")} —{" "}
                <Link href="/vendors/apply" className="font-semibold underline">continue your application</Link>.
              </div>
            )}

            {(app.status === "draft" || app.status === "info_requested" || app.status === "rejected") && (
              <div className="mt-6">
                <Button href="/vendors/apply">
                  {app.status === "draft" ? "Continue application" : "Update & resubmit"}
                </Button>
              </div>
            )}
            {app.status === "approved" && (
              <div className="mt-6">
                <Button href="/vendor-dashboard">Open vendor dashboard</Button>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 rounded-card p-6">
            <h2 className="font-semibold text-mist-100">Review team messages</h2>
            {thread?.messages?.length ? (
              <ul className="mt-4 space-y-4">
                {thread.messages
                  .sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
                  .map((m: { id: string; sender_role: string; body: string; created_at: string }) => (
                    <li key={m.id} className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        {m.sender_role === "admin" ? "Review team" : "You"} ·{" "}
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-mist-200">{m.body}</p>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-mist-400">
                No messages yet. If the review team needs anything, their questions appear here and
                you&apos;ll also see the status change to “Information requested”.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
