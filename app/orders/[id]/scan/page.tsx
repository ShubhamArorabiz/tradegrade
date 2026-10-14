import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Order } from "@/lib/types";
import Scanner from "./Scanner";

export const metadata = { title: "Scan pickup" };

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/orders/${id}/scan`);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order || order.seller_id !== user.id) notFound();
  return <Scanner orderId={order.id} done={order.status === "completed"} payoutCents={order.amount_cents - order.fee_cents} />;
}
