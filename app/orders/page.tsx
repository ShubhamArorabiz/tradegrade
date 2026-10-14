import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { money, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/types";
import BackHeader from "@/components/BackHeader";

export const metadata = { title: "Orders" };

const LABEL: Record<Order["status"], string> = {
  pending: "Checking out",
  paid: "Ready for pickup",
  completed: "Picked up",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "bought" } = await searchParams;
  const { supabase, user } = await requireUser("/orders");
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq(tab === "sold" ? "seller_id" : "buyer_id", user.id)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data ?? []) as Order[];
  const { data: listings } = orders.length
    ? await createAdminClient().from("listings").select("id, title, photos").in("id", orders.map((o) => o.listing_id))
    : { data: [] };
  const byId = new Map((listings ?? []).map((l) => [l.id, l]));

  return (
    <main className="with-tabs">
      <BackHeader title="Orders" href="/profile" />
      <div className="page pt-4">
        <div className="flex gap-2">
          <Link href="/orders?tab=bought" className={tab !== "sold" ? "chip-on" : "chip"}>
            Bought
          </Link>
          <Link href="/orders?tab=sold" className={tab === "sold" ? "chip-on" : "chip"}>
            Sold
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {orders.length === 0 && <p className="card p-6 text-center text-sm text-muted">No orders yet.</p>}
          {orders.map((o) => {
            const l = byId.get(o.listing_id);
            return (
              <Link key={o.id} href={`/orders/${o.id}`} className="card flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l?.photos?.[0]} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l?.title}</p>
                  <p className="text-[13px] text-muted">
                    {money(o.amount_cents)} · {timeAgo(o.created_at)}
                  </p>
                </div>
                <span className={`badge ${o.status === "paid" ? "bg-warn-soft text-warn" : o.status === "completed" ? "bg-ok-soft text-ok" : "bg-surface-2 text-faint"}`}>
                  {LABEL[o.status]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
