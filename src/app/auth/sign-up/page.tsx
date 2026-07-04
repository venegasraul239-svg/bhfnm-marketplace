import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = {
  title: "Create account — BHFNM Marketplace",
  robots: { index: false },
};

export default function SignUpPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-bold text-mist-100">Create your account</h1>
      <p className="mt-2 text-sm text-mist-400">
        Buyer accounts are instant. Selling requires a separate application and verification after
        you sign up.
      </p>
      <div className="card-surface mt-8 rounded-card p-6">
        <Suspense>
          <AuthForm mode="sign-up" />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-mist-400">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-jade-300 hover:text-jade-200">
          Sign in
        </Link>
      </p>
    </div>
  );
}
