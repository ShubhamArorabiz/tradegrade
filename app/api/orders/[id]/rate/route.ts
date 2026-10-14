import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

const Body = z.object({ stars: z.number().int().min(1).max(5), note: z.string().trim().max(300).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick 1 to 5 stars");

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order || ![order.buyer_id, order.seller_id].includes(ctx.user.id)) return fail("Order not found", 404);
  if (order.status !== "completed") return fail("You can rate after pickup");

  const to = ctx.user.id === order.buyer_id ? order.seller_id : order.buyer_id;
  const { error } = await db
    .from("ratings")
    .upsert({ order_id: id, from_id: ctx.user.id, to_id: to, stars: parsed.data.stars, note: parsed.data.note || null }, { onConflict: "order_id,from_id" });
  if (error) return fail("Couldn't save rating", 500);
  return NextResponse.json({ ok: true });
}
