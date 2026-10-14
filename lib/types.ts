export type Condition = "new" | "like_new" | "used" | "salvage";
export type Grade = "structural" | "non_structural" | "scrap";
export type Loading = "hand" | "forklift" | "truck";
export type ListingStatus = "active" | "reserved" | "sold" | "removed";
export type OrderStatus = "pending" | "paid" | "completed" | "cancelled" | "refunded";

export type Profile = {
  id: string;
  full_name: string | null;
  company: string | null;
  trade: string | null;
  role: "user" | "admin";
  suspended: boolean;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  created_at: string;
};

export type SellerStats = {
  id: string;
  rating_avg: number;
  rating_count: number;
  completed_sales: number;
  verified_business: boolean;
};

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  condition: Condition;
  grade: Grade | null;
  specs: Record<string, string>;
  quantity: number;
  unit: string;
  price_cents: number;
  loading: Loading;
  photos: string[];
  lat: number;
  lng: number;
  area_label: string | null;
  pickup_address: string | null;
  pickup_notes: string | null;
  status: ListingStatus;
  reserved_until: string | null;
  expires_at: string;
  created_at: string;
};

/** Row from the public listing_cards view (no pickup address, rounded location). */
export type ListingCard = Omit<Listing, "pickup_address" | "pickup_notes" | "reserved_until"> & {
  ai_assisted: boolean;
  seller_company: string | null;
  seller_name: string | null;
};

/** Row from nearby_listings(). */
export type NearbyListing = {
  id: string;
  title: string;
  category: string;
  condition: Condition;
  quantity: number;
  unit: string;
  price_cents: number;
  photos: string[];
  area_label: string | null;
  created_at: string;
  seller_company: string | null;
  verified_business: boolean;
  distance_km: number;
  approx_lat: number;
  approx_lng: number;
};

export type Order = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  fee_cents: number;
  status: OrderStatus;
  payout_status: "none" | "waiting_for_seller" | "paid_out" | "failed";
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  as_is_accepted_at: string;
  pickup_deadline: string | null;
  pickup_attempts: number;
  cancel_reason: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
};

export type Message = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/** What Claude returns for a set of listing photos. */
export type ListingDraft = {
  is_building_material: boolean;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  condition: Condition;
  grade: Grade;
  specs: { name: string; value: string }[];
  description: string;
  price_low_cad: number;
  price_high_cad: number;
  suggested_price_cad: number;
  uncertain_fields: string[];
};
