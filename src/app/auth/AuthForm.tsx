"use client";

// Shared email+password form for sign-in and sign-up. Uses the Supabase
// browser client; sessions are cookie-based so server components see them.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sb = supabaseBrowser();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sb) {
      setError("Accounts are not available on this environment (backend not configured).");
      return;
    }
    setBusy(true);
    try {
      const { error } =
        mode === "sign-in"
          ? await sb.auth.signInWithPassword({ email, password })
          : await sb.auth.signUp({ email, password });
      if (error) {
        setError(friendly(error.message));
        return;
      }
      // Ensure a profiles row exists before landing anywhere role-gated.
      await fetch("/marketplace/api/auth/ensure-profile", { method: "POST" });
      const next = params.get("next");
      // router.push prefixes the /marketplace basePath itself.
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
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
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-mist-200">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none"
          placeholder="Minimum 8 characters"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/already registered/i.test(message)) return "An account with this email already exists — try signing in.";
  if (/rate limit/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}
