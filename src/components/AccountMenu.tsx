"use client";

// Client island: shows Sign in vs. account links from the browser session,
// keeping the header (and public pages) statically renderable.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag, User } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AccountMenu() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setSignedIn(false);
      return;
    }
    sb.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (signedIn === false) {
    return (
      <Link
        href="/auth/sign-in"
        className="rounded-lg px-3 py-2 text-sm font-semibold text-mist-200 hover:bg-ink-800 hover:text-mist-100"
      >
        Sign in
      </Link>
    );
  }

  // Signed-in and loading states share the icon layout (no flash).
  return (
    <>
      <Link href="/account" aria-label="Account" className="rounded-lg p-2 text-mist-300 hover:bg-ink-800 hover:text-mist-100">
        <User className="h-5 w-5" />
      </Link>
      <Link href="/orders" aria-label="Orders" className="rounded-lg p-2 text-mist-300 hover:bg-ink-800 hover:text-mist-100">
        <ShoppingBag className="h-5 w-5" />
      </Link>
    </>
  );
}
