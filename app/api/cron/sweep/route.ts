import { NextResponse } from "next/server";
import { sweepOrders } from "@/lib/orders";

/** Daily (Vercel cron): refund missed pickups and clear abandoned checkouts. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepOrders());
}
