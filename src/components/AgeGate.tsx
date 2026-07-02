"use client";

// Strict 21+ age gate. Full-screen modal, real date-of-birth entry (not a
// checkbox), country/region aware, persisted in localStorage. Underage entry
// produces a hard access-denied state for the session.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

const STORAGE_KEY = "bhfnm-age-gate-v1";
const MIN_AGE = 21;

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const CA_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

interface GateRecord {
  confirmedAt: string;
  country: string;
  region: string;
}

function ageFrom(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function AgeGate() {
  const [status, setStatus] = useState<"loading" | "open" | "denied" | "passed">("loading");
  const [country, setCountry] = useState("US");
  const [region, setRegion] = useState("");
  const [dob, setDob] = useState({ month: "", day: "", year: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const rec = JSON.parse(raw) as GateRecord;
        if (rec.confirmedAt) {
          setStatus("passed");
          return;
        }
      }
    } catch {
      // fall through to open gate
    }
    setStatus("open");
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const m = parseInt(dob.month, 10);
    const d = parseInt(dob.day, 10);
    const y = parseInt(dob.year, 10);
    if (!m || !d || !y || y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) {
      setError("Enter a valid date of birth.");
      return;
    }
    if (!region) {
      setError(`Select your ${country === "CA" ? "province" : "state"}.`);
      return;
    }
    const birth = new Date(y, m - 1, d);
    if (ageFrom(birth) < MIN_AGE) {
      setStatus("denied");
      return;
    }
    const rec: GateRecord = { confirmedAt: new Date().toISOString(), country, region };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    // Destination hint for availability notices elsewhere in the UI.
    document.cookie = `bhfnm-dest=${country}-${region};path=/;max-age=31536000;samesite=lax`;
    setStatus("passed");
  }

  if (status === "loading" || status === "passed") return null;

  const regions = country === "CA" ? CA_PROVINCES : US_STATES;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/95 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Age verification"
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="card-surface w-full max-w-md rounded-2xl p-8"
        >
          {status === "denied" ? (
            <div className="text-center">
              <h2 className="font-display text-xl font-bold text-mist-100">Access not available</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">
                You must be {MIN_AGE} or older to browse cannabinoid products on this marketplace. Educational
                content remains available on{" "}
                <a href="https://buyhempflowernearme.com/" className="text-jade-300 underline">
                  Buy Hemp Flower Near Me
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-500/15">
                  <ShieldCheck className="h-5 w-5 text-jade-400" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-mist-100">Age verification required</h2>
                  <p className="text-xs text-mist-400">This marketplace lists hemp-derived cannabinoid products.</p>
                </div>
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-mist-300">Country</span>
                    <select
                      value={country}
                      onChange={(e) => { setCountry(e.target.value); setRegion(""); }}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-mist-300">
                      {country === "CA" ? "Province" : "State"}
                    </span>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-sm text-mist-100 focus:border-jade-500 focus:outline-none"
                    >
                      <option value="">Select…</option>
                      {regions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset>
                  <legend className="mb-1 block text-xs font-medium text-mist-300">Date of birth</legend>
                  <div className="grid grid-cols-3 gap-3">
                    {(["month", "day", "year"] as const).map((f) => (
                      <input
                        key={f}
                        inputMode="numeric"
                        placeholder={f === "month" ? "MM" : f === "day" ? "DD" : "YYYY"}
                        aria-label={f}
                        maxLength={f === "year" ? 4 : 2}
                        value={dob[f]}
                        onChange={(e) => setDob({ ...dob, [f]: e.target.value.replace(/\D/g, "") })}
                        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-center text-sm text-mist-100 placeholder:text-mist-400 focus:border-jade-500 focus:outline-none"
                      />
                    ))}
                  </div>
                </fieldset>

                {error && <p className="text-xs text-signal-red">{error}</p>}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-jade-500 py-3 text-sm font-bold text-ink-950 transition-colors hover:bg-jade-400"
                >
                  Confirm and enter
                </button>

                <p className="text-[11px] leading-relaxed text-mist-400">
                  By entering you confirm you are {MIN_AGE}+ and agree to use this marketplace responsibly.
                  Product availability is destination-dependent and enforced at checkout. Nothing on this site is
                  legal or medical advice.
                </p>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
