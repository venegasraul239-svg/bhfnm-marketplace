// Shipping label abstraction. Every label is platform-generated — vendors can
// never paste arbitrary tracking numbers. "Shipped" requires a carrier
// acceptance scan ingested through the tracking webhook.

export interface Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface Parcel {
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface LabelRequest {
  orderId: string;
  from: Address;      // must match vendor's verified shipping origin
  to: Address;
  parcel: Parcel;
  carrier: string;
  service: string;
}

export interface Label {
  trackingNumber: string;
  labelUrl: string;
  costCents: number;
  carrier: string;
  service: string;
}

export interface TrackingEvent {
  carrierEventId: string;
  code: "accepted" | "in_transit" | "out_for_delivery" | "delivered" | "failed" | "returned";
  description: string;
  location?: string;
  occurredAt: string;
}

export interface ShippingProvider {
  readonly name: string;
  createLabel(req: LabelRequest): Promise<Label>;
  parseTrackingWebhook(rawBody: string, signature: string | null): TrackingEvent[];
}

export class ShippingNotConfiguredError extends Error {
  constructor() {
    super("Shipping label provider is not configured on this environment.");
    this.name = "ShippingNotConfiguredError";
  }
}

/** Approved carrier/service matrix at launch (admin-configurable in DB later). */
export const APPROVED_SERVICES = [
  { carrier: "usps", service: "priority" },
  { carrier: "usps", service: "ground_advantage" },
  { carrier: "ups", service: "ground" },
  { carrier: "canada_post", service: "expedited" },
] as const;
