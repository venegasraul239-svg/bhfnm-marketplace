import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = {
  title: "Sign in — BHFNM Marketplace",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-mist-100">Sign in</h1>
      <p className="mt-2 text-sm text-mist-400">
        Buyer, vendor, and admin accounts all sign in here.
      </p>
      <div className="card-surface mt-8 rounded-card p-6">
        <Suspense>
          <AuthForm mode="sign-in" />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-mist-400">
        New to the marketplace?{" "}
        <Link href="/auth/sign-up" className="font-semibold text-jade-300 hover:text-jade-200">
          Create an account
        </Link>
      </p>
    </div>
  );
}
