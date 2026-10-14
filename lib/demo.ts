import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Test-site mode: Claude and payments are faked, and sign-in uses demo accounts. */
export const demoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "tradegrade-demo";

const PEOPLE = [
  { key: "admin", full_name: "Marco Rossi", company: "Rossi Framing Ltd", trade: "Framing" },
  { key: "seller", full_name: "Priya Shah", company: "Northline Interiors", trade: "Drywall" },
  { key: "buyer", full_name: "Dan Okafor", company: null, trade: "DIY / homeowner" },
] as const;

// [seller index, photo, title, category, qty, unit, condition, grade, price cents, loading, lat, lng, area, specs]
const LISTINGS = [
  [0, "lumber", "36 pcs 2x6x12 SPF lumber, kiln dried", "Lumber", 36, "pcs", "new", "structural", 18000, "hand", 43.6383, -79.4235, "Liberty Village", { Size: "2x6x12", Species: "SPF #2" }],
  [0, "plywood", "14 sheets 3/4 in plywood, 4x8", "Lumber", 14, "sheets", "like_new", "structural", 32000, "forklift", 43.6436, -79.4006, "King West", { Thickness: "3/4 in", Size: "4x8" }],
  [1, "drywall", "40 sheets 1/2 in drywall, 4x8", "Drywall", 40, "sheets", "new", "non_structural", 34000, "forklift", 43.6629, -79.3957, "Annex", { Thickness: "1/2 in", Brand: "CGC" }],
  [1, "insulation", "6 bags R20 batt insulation", "Insulation", 6, "bags", "new", "non_structural", 9000, "hand", 43.6677, -79.3375, "Leslieville", { Rating: "R20", Width: "15 in" }],
  [1, "tile", "22 boxes porcelain floor tile, 12x24", "Flooring & Tile", 22, "boxes", "new", "non_structural", 26000, "hand", 43.6512, -79.3471, "Corktown", { Size: "12x24 in", Colour: "Warm grey" }],
  [0, "steel", "Steel studs, 25 ga, 10 ft, 60 pcs", "Steel & Metal", 60, "pcs", "used", "non_structural", 7500, "truck", 43.7001, -79.4163, "Midtown", { Gauge: "25", Length: "10 ft" }],
  [1, "shingles", "Asphalt shingles, 9 bundles, charcoal", "Roofing", 9, "bundles", "new", "non_structural", 0, "hand", 43.6896, -79.2963, "East York", {}],
  [0, "pipe", "PVC pipe offcuts, 3 in, mixed lengths", "Plumbing", 1, "lot", "salvage", "scrap", 0, "hand", 43.6205, -79.5132, "Etobicoke", {}],
  [1, "lumber", "Pressure-treated 4x4 posts, 8 ft, 12 pcs", "Lumber", 12, "pcs", "new", "structural", 14500, "hand", 43.7615, -79.4111, "North York", { Size: "4x4x8" }],
] as const;

export function demoEmail(key: "admin" | "seller" | "buyer") {
  if (key === "admin") return process.env.DEMO_ADMIN_EMAIL || "admin@tradegrade.ca";
  return `demo-${key}@tradegrade.ca`;
}

/**
 * Creates the demo accounts and sample listings. Safe to run twice: existing
 * accounts are reused and listings are only added when the database has none.
 */
export async function seedDemo(origin: string) {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) throw new Error("Set DEMO_ADMIN_PASSWORD (10+ characters) first");
  const db = createAdminClient();

  const { data: existing, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const ids: string[] = [];
  for (const p of PEOPLE) {
    const email = demoEmail(p.key);
    const password = p.key === "admin" ? adminPassword : DEMO_PASSWORD;
    let id = existing.users.find((u) => u.email === email)?.id;
    if (id) {
      await db.auth.admin.updateUserById(id, { password });
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      id = data.user.id;
    }
    const { error } = await db.from("profiles").update({ full_name: p.full_name, company: p.company, trade: p.trade }).eq("id", id);
    if (error) throw error;
    ids.push(id);
  }
  await db.from("profiles").update({ role: "admin", payouts_enabled: true, stripe_account_id: "mock_acct_demo" }).eq("id", ids[0]);
  await db.from("profiles").update({ payouts_enabled: true, stripe_account_id: "mock_acct_demo_2" }).eq("id", ids[1]);

  const { count } = await db.from("listings").select("id", { count: "exact", head: true });
  if (count) return { accounts: ids.length, listings: 0, note: "Listings already exist, so none were added." };

  let added = 0;
  for (const [i, [who, photo, title, category, quantity, unit, condition, grade, price, loading, lat, lng, area, specs]] of LISTINGS.entries()) {
    const img = await fetch(new URL(`/seed/${photo}.jpg`, origin));
    if (!img.ok) throw new Error(`Couldn't load sample photo ${photo}`);
    const path = `${ids[who]}/demo-${i}.jpg`;
    await db.storage.from("listing-photos").upload(path, await img.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
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
    if (error) throw error;
    added++;
  }
  return { accounts: ids.length, listings: added };
}
