import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { DraftError, draftListingFromPhotos, mockDraft } from "@/lib/claude";
import { AI_DAILY_LIMIT, MAX_PHOTOS } from "@/lib/constants";

export const maxDuration = 30;

const Body = z.object({ photos: z.array(z.string().url()).min(1).max(MAX_PHOTOS) });

/** Snap-to-list: Claude reads the uploaded photos and returns a listing draft. */
export async function POST(req: Request) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Add at least one photo");

  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${ctx.user.id}/`;
  if (!parsed.data.photos.every((p) => p.startsWith(prefix))) return fail("Photos must be uploaded from this device");

  const db = createAdminClient();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).gte("created_at", since);
  if ((count ?? 0) >= AI_DAILY_LIMIT) return fail("You've hit today's limit for photo drafts. You can still type the listing in.", 429);
  await db.from("ai_usage").insert({ user_id: ctx.user.id });

  if (process.env.AI_MODE === "mock" || process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    await new Promise((r) => setTimeout(r, 2500));
    return NextResponse.json({ draft: mockDraft() });
  }

  try {
    const images = await Promise.all(
      parsed.data.photos.map(async (url) => {
        const path = url.slice(url.indexOf("/listing-photos/") + "/listing-photos/".length);
        const { data, error } = await db.storage.from("listing-photos").download(path);
        if (error || !data) throw new DraftError("Photo upload didn't finish");
        const type = data.type === "image/png" || data.type === "image/webp" ? data.type : "image/jpeg";
        return { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mediaType: type as "image/jpeg" | "image/png" | "image/webp" };
      }),
    );
    const draft = await draftListingFromPhotos(images);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof DraftError) return fail(err.message, 422);
    if (err instanceof Anthropic.APIConnectionTimeoutError) return fail("Claude took too long. Fill it in yourself or try again.", 504);
    if (err instanceof Anthropic.RateLimitError) return fail("Photo drafts are busy right now. Try again in a minute.", 503);
    if (err instanceof Anthropic.APIError) {
      console.error("claude draft failed", err.status, err.message);
      return fail("Couldn't read the photos right now", 502);
    }
    console.error("draft failed", err);
    return fail("Couldn't read the photos right now", 500);
  }
}
