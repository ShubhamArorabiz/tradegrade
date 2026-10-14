import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, fail } from "@/lib/api";
import { CATEGORIES, LISTING_DAYS, MAX_PHOTOS, MAX_PRICE_CENTS, MIN_PRICE_CENTS } from "@/lib/constants";
import { SUPABASE_URL } from "@/lib/supabase/url";

const Body = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(""),
  category: z.enum(CATEGORIES),
  condition: z.enum(["new", "like_new", "used", "salvage"]),
  grade: z.enum(["structural", "non_structural", "scrap"]).nullable(),
  specs: z.record(z.string().max(60), z.string().max(120)).default({}),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  price_cents: z
    .number()
    .int()
    .refine((v) => v === 0 || (v >= MIN_PRICE_CENTS && v <= MAX_PRICE_CENTS), "Price must be Free or between $5 and $25,000"),
  loading: z.enum(["hand", "forklift", "truck"]),
  photos: z.array(z.string().url()).min(1).max(MAX_PHOTOS),
  lat: z.number().min(41).max(57),
  lng: z.number().min(-96).max(-74),
  area_label: z.string().trim().max(60).nullable(),
  pickup_address: z.string().trim().max(200).nullable(),
  pickup_notes: z.string().trim().max(300).nullable(),
  ai_draft: z.unknown().optional(),
});

export async function POST(req: Request) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the listing details");
  const { lat, lng, ai_draft, photos, ...fields } = parsed.data;

  const bucketPrefix = `${SUPABASE_URL}/storage/v1/object/public/listing-photos/${ctx.user.id}/`;
  if (!photos.every((p) => p.startsWith(bucketPrefix))) return fail("Photos must be uploaded from this device");

  const { data, error } = await ctx.supabase
    .from("listings")
    .insert({
      ...fields,
      photos,
      seller_id: ctx.user.id,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      ai_draft: ai_draft ?? null,
      expires_at: new Date(Date.now() + LISTING_DAYS * 86400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return NextResponse.json({ id: data.id });
}
