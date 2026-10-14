import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { maskContactDetails } from "@/lib/orders";
import type { Order } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  const text = body?.trim().slice(0, 500);
  if (!text) return fail("Message is empty");

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order || ![order.buyer_id, order.seller_id].includes(ctx.user.id)) return fail("Order not found", 404);
  if (!["paid", "completed"].includes(order.status)) return fail("Chat is closed for this order");

  const { data, error } = await db
    .from("messages")
    .insert({ order_id: id, sender_id: ctx.user.id, body: order.status === "completed" ? text : maskContactDetails(text) })
    .select("*")
    .single();
  if (error) return fail("Couldn't send", 500);
  return NextResponse.json({ message: data });
}
