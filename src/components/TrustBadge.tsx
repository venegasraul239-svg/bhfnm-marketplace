import { BADGE_META } from "@/lib/badges";
import type { BadgeKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BadgeCheck, FlaskConical, Leaf, Factory, Package, ShieldCheck, Star, Truck, Boxes, Tag, CalendarCheck } from "lucide-react";

const ICONS: Record<BadgeKey, typeof BadgeCheck> = {
  identity_verified_seller: ShieldCheck,
  verified_coa: FlaskConical,
  batch_linked_coa: BadgeCheck,
  recently_tested: CalendarCheck,
  marketplace_shipping_tracking: Truck,
  top_rated_seller: Star,
  wholesale_capable: Boxes,
  private_label_capable: Tag,
  manufacturer_direct: Factory,
  farm_direct: Leaf,
  verified_brand: Package,
};

export function TrustBadge({ badge, size = "md" }: { badge: BadgeKey; size?: "sm" | "md" }) {
  const meta = BADGE_META[badge];
  const Icon = ICONS[badge];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-jade-500/30 bg-jade-500/10 font-medium text-jade-300",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {meta.label}
    </span>
  );
}

export function BadgeRow({ badges, max, size = "md" }: { badges: BadgeKey[]; max?: number; size?: "sm" | "md" }) {
  const shown = max ? badges.slice(0, max) : badges;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((b) => (
        <TrustBadge key={b} badge={b} size={size} />
      ))}
      {max && badges.length > max && (
        <span className="inline-flex items-center rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-mist-400">
          +{badges.length - max} more
        </span>
      )}
    </div>
  );
}
