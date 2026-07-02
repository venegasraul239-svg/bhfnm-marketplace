"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function ReportForm({ productSlug }: { productSlug: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/marketplace/api/report-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd)),
    });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return (
      <p className="mt-8 rounded-card border border-jade-500/30 bg-jade-500/10 p-5 text-sm text-jade-300">
        Report received. Our compliance team reviews every report; listings with confirmed issues are suspended
        pending seller correction.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-mist-300">Product</span>
        <input name="product" defaultValue={productSlug} required className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-mist-300">Reason</span>
        <select name="reason" required className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none">
          <option value="">Select…</option>
          <option value="coa_issue">COA problem or mismatch</option>
          <option value="wrong_data">Incorrect cannabinoid data</option>
          <option value="counterfeit">Counterfeit / misrepresented product</option>
          <option value="policy_violation">Policy violation</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-mist-300">Details</span>
        <textarea name="details" rows={5} required className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-mist-300">Your email (optional, for follow-up)</span>
        <input name="email" type="email" className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none" />
      </label>
      {state === "error" && <p className="text-xs text-signal-red">Something went wrong — please try again.</p>}
      <Button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Submit report"}</Button>
    </form>
  );
}
