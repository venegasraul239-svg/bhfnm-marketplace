import type { Metadata } from "next";
import { BUYER_NAV, DashboardShell } from "@/components/DashboardShell";
import { Button, StatusPill } from "@/components/ui";
import { Check, Circle } from "lucide-react";

export const metadata: Metadata = { title: "Order detail", robots: { index: false } };

const TIMELINE = [
  { label: "BTC invoice settled", detail: "0.000912 BTC on-chain · Jun 29, 10:14", done: true },
  { label: "Order accepted by seller", detail: "Blue Ridge Hemp Co. · Jun 29, 11:02", done: true },
  { label: "Label created", detail: "USPS Priority · platform-generated · Jun 29, 14:40", done: true },
  { label: "Carrier acceptance scan", detail: "Asheville NC distribution center · Jun 30, 09:12", done: true },
  { label: "In transit", detail: "Last scan: Charlotte NC · Jul 1, 22:30", done: true },
  { label: "Delivered", detail: "Pending", done: false },
  { label: "Dispute window (48h)", detail: "Starts at delivery", done: false },
  { label: "Order complete → review request", detail: "", done: false },
];

export default function OrderDetailPage() {
  return (
    <DashboardShell title="Order BH-2607-4F2A1C" nav={BUYER_NAV} active="/orders">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card-surface rounded-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-mist-100">Shipping timeline</h2>
            <StatusPill tone="info">In transit</StatusPill>
          </div>
          <ol className="mt-6 space-y-5">
            {TIMELINE.map((t) => (
              <li key={t.label} className="flex gap-3">
                {t.done ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-jade-500/20">
                    <Check className="h-3 w-3 text-jade-400" aria-hidden />
                  </span>
                ) : (
                  <Circle className="mt-1 h-4 w-4 shrink-0 text-ink-600" aria-hidden />
                )}
                <div>
                  <p className={`text-sm font-medium ${t.done ? "text-mist-100" : "text-mist-400"}`}>{t.label}</p>
                  {t.detail && <p className="text-xs text-mist-400">{t.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="card-surface rounded-card p-6">
            <h2 className="font-semibold text-mist-100">Items</h2>
            <ul className="mt-3 space-y-2 text-sm text-mist-300">
              <li className="flex justify-between"><span>2× Appalachian Haze 7g</span><span>$84.00</span></li>
            </ul>
            <div className="mt-3 border-t border-ink-700 pt-3 text-sm">
              <div className="flex justify-between text-mist-400"><span>Shipping</span><span>Included</span></div>
              <div className="mt-1 flex justify-between font-semibold text-mist-100"><span>Total</span><span>$84.00</span></div>
              <p className="mt-2 text-xs text-mist-400">Paid via BTCPay invoice · batch AH-2605 COA snapshotted to this order.</p>
            </div>
          </div>
          <div className="card-surface rounded-card p-6">
            <h2 className="font-semibold text-mist-100">Need help?</h2>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="secondary" size="sm" href="/messages">Message seller</Button>
              <Button variant="ghost" size="sm" href="/disputes">Open a dispute (after delivery)</Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist-400">
              Dispute eligibility: damaged, wrong, materially different, missing items, or verified shipment failure —
              within 48 hours of delivery.
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
