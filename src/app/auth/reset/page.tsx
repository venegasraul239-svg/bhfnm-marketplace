"use client";

// Landing page for the password-recovery link: Supabase establishes a
// recovery session from the URL hash, then we set the new password.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    // Recovery links land with a session in the URL; detectSessionInUrl in the
    // browser client picks it up. Wait for it before enabling the form.
    sb.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      setState("error");
      return;
    }
    const sb = supabaseBrowser();
    if (!sb) return;
    setState("busy");
    setError(null);
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setState("error");
      return;
    }
    setState("done");
    setTimeout(() => router.push("/account"), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-mist-100">Choose a new password</h1>
      <div className="card-surface mt-8 rounded-card p-6">
        {state === "done" ? (
          <p className="text-sm text-jade-300" role="status">
            Password updated — taking you to your account…
          </p>
        ) : !ready ? (
          <p className="text-sm text-mist-400">
            Validating your reset link… If nothing happens, the link may have expired — request a
            new one from the sign-in page.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-mist-200">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-mist-200">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
                {error}
              </p>
            )}
            <Button type="submit" disabled={state === "busy"} className="w-full">
              {state === "busy" ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
