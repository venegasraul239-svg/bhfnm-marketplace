"use client";

// Request a password-reset email (sent by Supabase Auth via the configured
// SMTP sender — no-reply@buyhempflowernearme.com once Resend SMTP is set).

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) {
      setError("Accounts are not available on this environment.");
      setState("error");
      return;
    }
    setState("busy");
    setError(null);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: "https://buyhempflowernearme.com/marketplace/auth/reset",
    });
    if (error) {
      setError(error.message);
      setState("error");
      return;
    }
    setState("sent");
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-mist-100">Reset your password</h1>
      <p className="mt-2 text-sm text-mist-400">
        Enter your account email and we&apos;ll send a reset link.
      </p>
      <div className="card-surface mt-8 rounded-card p-6">
        {state === "sent" ? (
          <p className="text-sm text-jade-300" role="status">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check
            your inbox (and spam folder) — the link is valid for one hour.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-mist-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
                {error}
              </p>
            )}
            <Button type="submit" disabled={state === "busy"} className="w-full">
              {state === "busy" ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-mist-400">
        Remembered it?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-jade-300 hover:text-jade-200">
          Sign in
        </Link>
      </p>
    </div>
  );
}
