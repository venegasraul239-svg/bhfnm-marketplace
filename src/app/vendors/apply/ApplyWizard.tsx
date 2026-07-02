"use client";

// Six-step vendor application. Autosaves to localStorage on every change and
// syncs to /api/vendor/applications when a backend is configured. Submission
// always requires the server — there is no fake approval path.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { CheckCircle2, CloudUpload, Save } from "lucide-react";

const STORAGE_KEY = "bhfnm-vendor-application-v1";

const STEPS = [
  "Account",
  "Business verification",
  "Store profile",
  "Compliance setup",
  "Product upload",
  "Review & submit",
] as const;

type StepData = Record<string, string | boolean>;
type AppData = Record<number, StepData>;

const SELLER_TYPES = [
  "Hemp farm", "Hemp manufacturer", "CBD brand", "CBG brand", "THCA brand",
  "Hemp-derived cannabinoid brand", "Beverage brand", "Wellness brand",
  "Accessory retailer", "Distributor", "Wholesaler", "Retail store",
  "Private-label brand", "Approved dropshipper", "Approved reseller",
];

const CATEGORIES = [
  "Hemp Flower", "CBD Flower", "CBG Flower", "THCA Flower", "Pre-Rolls",
  "THC Drinks", "Gummies", "Edibles", "Vapes", "Concentrates", "Tinctures",
  "CBN Sleep", "Wellness", "Pet Products", "Accessories", "Wholesale", "Private Label",
];

function Field({
  label, name, step, data, setField, type = "text", required, placeholder, hint,
}: {
  label: string; name: string; step: number; data: AppData;
  setField: (step: number, name: string, value: string | boolean) => void;
  type?: string; required?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mist-300">
        {label} {required && <span className="text-jade-400">*</span>}
      </span>
      <input
        type={type}
        value={(data[step]?.[name] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => setField(step, name, e.target.value)}
        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 placeholder:text-mist-500 focus:border-jade-500 focus:outline-none"
      />
      {hint && <span className="mt-1 block text-[11px] text-mist-400">{hint}</span>}
    </label>
  );
}

function CheckField({
  label, name, step, data, setField,
}: {
  label: string; name: string; step: number; data: AppData;
  setField: (step: number, name: string, value: string | boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
      <input
        type="checkbox"
        checked={Boolean(data[step]?.[name])}
        onChange={(e) => setField(step, name, e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-jade-500"
      />
      <span className="text-sm text-mist-300">{label}</span>
    </label>
  );
}

export function ApplyWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<AppData>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData(parsed.data ?? {});
        setStep(parsed.step ?? 0);
      }
    } catch { /* fresh start */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
      setSavedAt(new Date().toLocaleTimeString());
    }, 400);
    return () => clearTimeout(t);
  }, [data, step]);

  function setField(s: number, name: string, value: string | boolean) {
    setData((d) => ({ ...d, [s]: { ...d[s], [name]: value } }));
  }

  const requiredByStep: Record<number, string[]> = useMemo(
    () => ({
      0: ["email", "phone", "country", "region", "company", "sellerType"],
      1: ["legalName", "regAddress", "ownerName", "idConfirm", "walletAddress", "agreementAccepted"],
      2: ["brandName", "slug", "about", "shippingOrigin", "supportEmail"],
      3: ["categories", "cannabinoids", "coaProcess", "handlingTime", "labelAgree", "messageAgree", "disputeAgree", "reserveAgree"],
    }),
    []
  );

  function stepComplete(s: number): boolean {
    const req = requiredByStep[s];
    if (!req) return true;
    return req.every((k) => {
      const v = data[s]?.[k];
      return typeof v === "boolean" ? v : Boolean(v && String(v).trim());
    });
  }

  async function submit() {
    setSubmitState("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/marketplace/api/vendor/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: data, submittedAt: new Date().toISOString() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(body?.error?.message ?? "Submission failed. Your progress is saved locally — please retry.");
        setSubmitState("error");
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      setSubmitState("done");
    } catch {
      setErrorMsg("Network error. Your progress is saved locally — please retry.");
      setSubmitState("error");
    }
  }

  if (submitState === "done") {
    return (
      <div className="mt-12 rounded-card border border-jade-500/30 bg-jade-500/10 p-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-jade-400" aria-hidden />
        <h2 className="mt-4 font-display text-xl font-bold text-mist-100">Application submitted</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-300">
          Our review team will verify your documents and follow up through your application inbox, usually within
          3–5 business days. You&apos;ll see a requirements checklist if anything is missing.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
      {/* Stepper */}
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0" aria-label="Application steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3 lg:py-2.5">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i === step
                  ? "bg-jade-500 text-ink-950"
                  : stepComplete(i) && i < step
                    ? "bg-jade-500/20 text-jade-300"
                    : "bg-ink-700 text-mist-400"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {stepComplete(i) && i < step ? "✓" : i + 1}
            </button>
            <span className={`hidden whitespace-nowrap text-sm lg:block ${i === step ? "font-semibold text-mist-100" : "text-mist-400"}`}>
              {label}
            </span>
          </li>
        ))}
        {savedAt && (
          <li className="mt-4 hidden items-center gap-1.5 text-[11px] text-mist-400 lg:flex">
            <Save className="h-3 w-3" aria-hidden /> Draft saved {savedAt}
          </li>
        )}
      </ol>

      {/* Step body */}
      <div className="card-surface rounded-card p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-mist-100">Step {step + 1}: {STEPS[step]}</h2>

        {step === 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" step={0} data={data} setField={setField} required />
            <Field label="Phone number" name="phone" step={0} data={data} setField={setField} required />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-mist-300">Country <span className="text-jade-400">*</span></span>
              <select
                value={(data[0]?.country as string) ?? ""}
                onChange={(e) => setField(0, "country", e.target.value)}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
              >
                <option value="">Select…</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </select>
            </label>
            <Field label="State / province" name="region" step={0} data={data} setField={setField} required />
            <Field label="Company name" name="company" step={0} data={data} setField={setField} required />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-mist-300">Seller type <span className="text-jade-400">*</span></span>
              <select
                value={(data[0]?.sellerType as string) ?? ""}
                onChange={(e) => setField(0, "sellerType", e.target.value)}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
              >
                <option value="">Select…</option>
                {SELLER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <Field label="Website" name="website" step={0} data={data} setField={setField} placeholder="https://" />
            <Field label="Social links" name="social" step={0} data={data} setField={setField} placeholder="Instagram, X, LinkedIn…" />
            <div className="sm:col-span-2">
              <Field label="Intended product categories" name="intendedCategories" step={0} data={data} setField={setField} placeholder="e.g. Hemp Flower, Gummies, Wholesale" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Legal business name" name="legalName" step={1} data={data} setField={setField} required />
            <Field label="DBA name" name="dba" step={1} data={data} setField={setField} />
            <Field label="EIN / tax ID" name="ein" step={1} data={data} setField={setField} hint="Stored encrypted; only the last 4 digits are retained after verification." />
            <Field label="Business registration #" name="regNumber" step={1} data={data} setField={setField} />
            <div className="sm:col-span-2">
              <Field label="Registered business address" name="regAddress" step={1} data={data} setField={setField} required />
            </div>
            <div className="sm:col-span-2">
              <Field label="Operating address (if different)" name="opAddress" step={1} data={data} setField={setField} />
            </div>
            <Field label="Owner / controller full name" name="ownerName" step={1} data={data} setField={setField} required />
            <Field label="License / permit numbers" name="licenses" step={1} data={data} setField={setField} hint="Farm, manufacturing, or distribution licenses where applicable." />
            <Field label="Insurance provider & policy" name="insurance" step={1} data={data} setField={setField} />
            <Field label="BTC / Lightning payout wallet" name="walletAddress" step={1} data={data} setField={setField} required hint="Ownership is verified via a signed message or micro-payment before payouts are enabled." />
            <div className="space-y-3 sm:col-span-2">
              <div className="rounded-lg border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-400">
                <CloudUpload className="mx-auto mb-2 h-5 w-5" aria-hidden />
                Document uploads (government ID, registration, licenses, insurance) are collected securely after
                account creation — files go to private storage, visible only to the review team.
              </div>
              <CheckField label="I confirm I can provide a government-issued ID for the owner/controller during review." name="idConfirm" step={1} data={data} setField={setField} />
              <CheckField label="I accept the BHFNM Marketplace Vendor Agreement." name="agreementAccepted" step={1} data={data} setField={setField} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" name="brandName" step={2} data={data} setField={setField} required />
            <Field label="Store slug" name="slug" step={2} data={data} setField={setField} required placeholder="your-brand" hint="Your storefront: /marketplace/store/your-brand" />
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-mist-300">About the brand <span className="text-jade-400">*</span></span>
                <textarea
                  rows={4}
                  value={(data[2]?.about as string) ?? ""}
                  onChange={(e) => setField(2, "about", e.target.value)}
                  className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
                />
              </label>
            </div>
            <Field label="Shipping origin (state/province)" name="shippingOrigin" step={2} data={data} setField={setField} required />
            <Field label="Support email" name="supportEmail" type="email" step={2} data={data} setField={setField} required />
            <Field label="Support phone" name="supportPhone" step={2} data={data} setField={setField} />
            <Field label="Support hours" name="supportHours" step={2} data={data} setField={setField} placeholder="Mon–Fri 9–5 ET" />
            <Field label="Minimum order quantity (wholesale)" name="moq" step={2} data={data} setField={setField} />
            <Field label="SEO description" name="seoDescription" step={2} data={data} setField={setField} hint="One factual sentence describing your store." />
            <div className="space-y-3 sm:col-span-2">
              <CheckField label="We offer wholesale pricing." name="wholesale" step={2} data={data} setField={setField} />
              <CheckField label="We offer private-label manufacturing." name="privateLabel" step={2} data={data} setField={setField} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-mist-300">Product categories you will sell <span className="text-jade-400">*</span></span>
              <input
                value={(data[3]?.categories as string) ?? ""}
                onChange={(e) => setField(3, "categories", e.target.value)}
                placeholder={CATEGORIES.slice(0, 5).join(", ") + "…"}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cannabinoid types" name="cannabinoids" step={3} data={data} setField={setField} required placeholder="CBD, CBG, THCA…" />
              <Field label="Manufacturing locations" name="mfgLocations" step={3} data={data} setField={setField} />
              <Field label="Restricted jurisdictions you already avoid" name="restricted" step={3} data={data} setField={setField} />
              <Field label="Lab partners" name="labs" step={3} data={data} setField={setField} placeholder="Lab name(s)" />
              <Field label="Batch tracking process" name="batchProcess" step={3} data={data} setField={setField} />
              <Field label="COA process" name="coaProcess" step={3} data={data} setField={setField} required placeholder="e.g. every batch, third-party, full panel" />
              <Field label="Inventory source" name="inventorySource" step={3} data={data} setField={setField} />
              <Field label="Typical handling time" name="handlingTime" step={3} data={data} setField={setField} required placeholder="e.g. 1–2 business days" />
            </div>
            <div className="space-y-3">
              <CheckField label="Our packaging carries required warnings and child-resistant features where applicable." name="packagingConfirm" step={3} data={data} setField={setField} />
              <CheckField label="We only sell age-restricted products to 21+ customers." name="ageConfirm" step={3} data={data} setField={setField} />
              <CheckField label="We agree to marketplace-generated tracking labels on every order." name="labelAgree" step={3} data={data} setField={setField} />
              <CheckField label="We agree to keep all buyer communication in the marketplace inbox." name="messageAgree" step={3} data={data} setField={setField} />
              <CheckField label="We accept the dispute policy, including admin final decisions." name="disputeAgree" step={3} data={data} setField={setField} />
              <CheckField label="We accept the rolling payout reserve policy for new sellers." name="reserveAgree" step={3} data={data} setField={setField} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm leading-relaxed text-mist-400">
              After approval you can create listings manually or import from CSV, Shopify, or WooCommerce.
              <strong className="text-mist-200"> Every imported or created product lands as a draft</strong> and goes
              through compliance review before it can appear publicly — no exceptions.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Manual listing creation", "CSV import", "Shopify import", "WooCommerce import"].map((m) => (
                <CheckField key={m} label={m} name={`method_${m}`} step={4} data={data} setField={setField} />
              ))}
            </div>
            <Field label="Approx. number of products at launch" name="productCount" step={4} data={data} setField={setField} placeholder="e.g. 25" />
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-mist-400">Requirements checklist — everything must be green before submission:</p>
            <ul className="space-y-2">
              {STEPS.slice(0, 4).map((label, i) => (
                <li key={label} className="flex items-center gap-2.5 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${stepComplete(i) ? "bg-jade-500/20 text-jade-300" : "bg-signal-red/15 text-signal-red"}`}>
                    {stepComplete(i) ? "✓" : "!"}
                  </span>
                  <span className={stepComplete(i) ? "text-mist-300" : "text-signal-red"}>
                    {label} {stepComplete(i) ? "complete" : "— missing required fields"}
                  </span>
                  {!stepComplete(i) && (
                    <button onClick={() => setStep(i)} className="text-xs text-jade-300 underline">fix</button>
                  )}
                </li>
              ))}
            </ul>
            <p className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3 text-xs leading-relaxed text-mist-400">
              After submission you&apos;ll get an application status page with a missing-requirements checklist and a
              direct Q&amp;A thread with the review team. Rejections include clear reason codes and you can resubmit
              corrections.
            </p>
            {errorMsg && <p className="text-sm text-signal-red">{errorMsg}</p>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-ink-700 pt-6">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            ← Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Continue →</Button>
          ) : (
            <Button
              onClick={submit}
              disabled={submitState === "sending" || !STEPS.slice(0, 4).every((_, i) => stepComplete(i))}
            >
              {submitState === "sending" ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
