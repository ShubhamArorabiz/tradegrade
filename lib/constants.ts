export const CATEGORIES = [
  "Lumber",
  "Drywall",
  "Insulation",
  "Electrical",
  "Plumbing",
  "Concrete & Masonry",
  "Steel & Metal",
  "Roofing",
  "Doors & Windows",
  "Flooring & Tile",
  "Fasteners & Hardware",
  "Tools & Equipment",
  "Other",
] as const;

export const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "used", label: "Used" },
  { value: "salvage", label: "Salvage" },
] as const;

export const GRADES = [
  { value: "structural", label: "Structural" },
  { value: "non_structural", label: "Non-structural" },
  { value: "scrap", label: "Scrap" },
] as const;

export const LOADING = [
  { value: "hand", label: "Hand-carry" },
  { value: "forklift", label: "Forklift" },
  { value: "truck", label: "Truck needed" },
] as const;

export const UNITS = [
  "lot", "pcs", "sheets", "bundles", "boxes", "bags", "skids", "rolls",
  "linear ft", "sq ft", "cu yd", "lbs", "tons",
] as const;

export const TRADES = [
  "General contractor",
  "Electrical",
  "Plumbing",
  "Framing",
  "Drywall",
  "HVAC",
  "Roofing",
  "Concrete",
  "DIY / homeowner",
  "Other",
] as const;

export const RADII_KM = [5, 10, 25] as const;
export const DEFAULT_RADIUS_KM = 10;

/** Downtown Toronto, used until the browser shares a location. */
export const DEFAULT_CENTER = { lat: 43.6532, lng: -79.3832 };

export const LISTING_DAYS = 7;
export const PICKUP_WINDOW_HOURS = 72;
export const BUYER_CANCEL_MINUTES = 60;
export const MAX_PHOTOS = 5;
export const MIN_PRICE_CENTS = 500;
export const MAX_PRICE_CENTS = 2_500_000;
export const AI_DAILY_LIMIT = 20;

export const QUICK_REPLIES = [
  "On my way",
  "10 min away",
  "At the gate",
  "Running late",
  "Ready for pickup",
  "Can we pick another time?",
];

export function platformFeePercent() {
  const n = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : 10;
}

export function feeFor(amountCents: number) {
  return Math.round((amountCents * platformFeePercent()) / 100);
}
