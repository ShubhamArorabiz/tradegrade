// Demo data for local testing: three sellers and a dozen listings around Toronto.
// Usage: node scripts/seed.mjs   (reads .env.local; never run against production)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url?.includes("127.0.0.1") && !process.argv.includes("--force")) {
  console.error("Refusing to seed a non-local Supabase. Pass --force if you really mean it.");
  process.exit(1);
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sellers = [
  { phone: "+14165550101", full_name: "Marco Rossi", company: "Rossi Framing Ltd", trade: "Framing" },
  { phone: "+14165550102", full_name: "Priya Shah", company: "Northline Interiors", trade: "Drywall" },
  { phone: "+14165550103", full_name: "Dan Okafor", company: null, trade: "DIY / homeowner" },
];

const listings = [
  [0, "lumber", "36 pcs 2x6x12 SPF lumber, kiln dried", "Lumber", 36, "pcs", "new", "structural", 18000, "hand", 43.6383, -79.4235, "Liberty Village", { Size: "2x6x12", Species: "SPF #2" }],
  [0, "plywood", "14 sheets 3/4 in plywood, 4x8", "Lumber", 14, "sheets", "like_new", "structural", 32000, "forklift", 43.6436, -79.4006, "King West", { Thickness: "3/4 in", Size: "4x8" }],
  [1, "drywall", "40 sheets 1/2 in drywall, 4x8", "Drywall", 40, "sheets", "new", "non_structural", 34000, "forklift", 43.6629, -79.3957, "Annex", { Thickness: "1/2 in", Brand: "CGC" }],
  [1, "insulation", "6 bags R20 batt insulation", "Insulation", 6, "bags", "new", "non_structural", 9000, "hand", 43.6677, -79.3375, "Leslieville", { Rating: "R20", Width: "15 in" }],
  [1, "tile", "22 boxes porcelain floor tile, 12x24", "Flooring & Tile", 22, "boxes", "new", "non_structural", 26000, "hand", 43.6512, -79.3471, "Corktown", { Size: "12x24 in", Colour: "Warm grey" }],
  [2, "steel", "Steel studs, 25 ga, 10 ft, 60 pcs", "Steel & Metal", 60, "pcs", "used", "non_structural", 7500, "truck", 43.7001, -79.4163, "Midtown", { Gauge: "25", Length: "10 ft" }],
  [2, "shingles", "Asphalt shingles, 9 bundles, charcoal", "Roofing", 9, "bundles", "new", "non_structural", 0, "hand", 43.6896, -79.2963, "East York", {}],
  [0, "pipe", "PVC pipe offcuts, 3 in, mixed lengths", "Plumbing", 1, "lot", "salvage", "scrap", 0, "hand", 43.6205, -79.5132, "Etobicoke", {}],
  [2, "lumber", "Pressure-treated 4x4 posts, 8 ft, 12 pcs", "Lumber", 12, "pcs", "new", "structural", 14500, "hand", 43.7615, -79.4111, "North York", { Size: "4x4x8" }],
];

const ids = [];
for (const s of sellers) {
  const { data, error } = await db.auth.admin.createUser({ phone: s.phone, phone_confirm: true });
  let id = data?.user?.id;
  if (error) {
    const { data: list } = await db.auth.admin.listUsers();
    id = list.users.find((u) => u.phone === s.phone.slice(1))?.id;
  }
  await db.from("profiles").update({ full_name: s.full_name, company: s.company, trade: s.trade }).eq("id", id);
  ids.push(id);
}
// The first seller is an admin and has payouts connected (mock).
await db.from("profiles").update({ role: "admin", payouts_enabled: true, stripe_account_id: "mock_acct_seed" }).eq("id", ids[0]);

for (const [i, [who, photo, title, category, quantity, unit, condition, grade, price, loading, lat, lng, area, specs]] of listings.entries()) {
  const path = `${ids[who]}/seed-${i}.jpg`;
  await db.storage.from("listing-photos").upload(path, readFileSync(`scripts/seed-photos/${photo}.jpg`), { contentType: "image/jpeg", upsert: true });
  const photoUrl = db.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  const { error } = await db.from("listings").insert({
    seller_id: ids[who],
    title,
    category,
    quantity,
    unit,
    condition,
    grade,
    price_cents: price,
    loading,
    specs,
    description: "Left over from a job, stored dry on site. Come check it before you buy.",
    photos: [photoUrl],
    location: `SRID=4326;POINT(${lng} ${lat})`,
    area_label: area,
    pickup_address: `${100 + i * 7} Example St, Toronto`,
    pickup_notes: "Ask for the site super at the gate",
    created_at: new Date(Date.now() - i * 3.5 * 3600_000).toISOString(),
  });
  if (error) console.error(title, error.message);
}
console.log("Seeded", sellers.length, "sellers and", listings.length, "listings. Test logins: 416 555 0101 / 0102 / 0103, code 123456");
