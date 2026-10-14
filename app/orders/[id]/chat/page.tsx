import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { Message, Order } from "@/lib/types";
import Chat from "./Chat";

export const metadata = { title: "Order chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/orders/${id}/chat`);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();

  const db = createAdminClient();
  const otherId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
  const [{ data: messages }, { data: other }, { data: listing }] = await Promise.all([
    supabase.from("messages").select("*").eq("order_id", id).order("created_at"),
    db.from("profiles").select("full_name, company").eq("id", otherId).single(),
    db.from("listings").select("title, photos").eq("id", order.listing_id).single(),
  ]);

  return (
    <Chat
      orderId={id}
      me={user.id}
      otherName={other?.company || other?.full_name || "Them"}
      title={listing?.title ?? "Order"}
      photo={listing?.photos?.[0]}
      open={["paid", "completed"].includes(order.status)}
      initial={(messages ?? []) as Message[]}
    />
  );
}
