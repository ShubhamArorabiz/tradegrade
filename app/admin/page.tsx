import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { refundOrder } from "@/lib/orders";
import { money, timeAgo } from "@/lib/format";
import type { Listing, Order, Profile } from "@/lib/types";
import BackHeader from "@/components/BackHeader";

export const metadata = { title: "Admin" };

async function refund(formData: FormData) {
  "use server";
  await requireAdmin();
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", String(formData.get("id"))).single<Order>();
  if (order) await refundOrder(order, "Refunded by TradeGrade");
  revalidatePath("/admin");
}

async function setListing(formData: FormData) {
  "use server";
  await requireAdmin();
  await createAdminClient().from("listings").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id"))).eq("status", "active");
  revalidatePath("/admin");
}

async function setSuspended(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === user.id) return;
  await createAdminClient().from("profiles").update({ suspended: formData.get("suspended") === "true" }).eq("id", id);
  revalidatePath("/admin");
}

async function resolveReport(formData: FormData) {
  "use server";
  await requireAdmin();
  await createAdminClient().from("reports").update({ resolved: true }).eq("id", String(formData.get("id")));
  revalidatePath("/admin");
}

const TABS = ["orders", "listings", "users", "reports"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireAdmin();
  const { tab = "orders", q = "" } = await searchParams;
  const db = createAdminClient();

  const { data: totals } = await db.from("orders").select("amount_cents, fee_cents, status").in("status", ["paid", "completed"]);
  const completed = (totals ?? []).filter((o) => o.status === "completed");
  const gmv = completed.reduce((s, o) => s + o.amount_cents, 0);
  const fees = completed.reduce((s, o) => s + o.fee_cents, 0);
  const awaiting = (totals ?? []).filter((o) => o.status === "paid").length;
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { count: pickupsThisWeek } = await db.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", weekAgo);

  return (
    <main className="with-tabs">
      <BackHeader title="Admin" href="/profile" />
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Pickups this week" value={String(pickupsThisWeek ?? 0)} />
          <Stat label="GMV (completed)" value={money(gmv)} />
          <Stat label="Fees earned" value={money(fees)} />
          <Stat label="Awaiting pickup" value={String(awaiting)} />
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t} href={`/admin?tab=${t}`} className={tab === t ? "chip-on capitalize" : "chip capitalize"}>
              {t}
            </Link>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          {tab === "orders" && <Orders />}
          {tab === "listings" && <Listings q={q} />}
          {tab === "users" && <Users q={q} />}
          {tab === "reports" && <Reports />}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-faint";
const td = "px-3 py-2 align-top";

async function Orders() {
  const { data } = await createAdminClient().from("orders").select("*, listings(title)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as (Order & { listings: { title: string } | null })[];
  return (
    <table className="card w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>When</th>
          <th className={th}>Item</th>
          <th className={th}>Amount</th>
          <th className={th}>Fee</th>
          <th className={th}>Status</th>
          <th className={th}>Payout</th>
          <th className={th} />
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((o) => (
          <tr key={o.id}>
            <td className={td}>{timeAgo(o.created_at)}</td>
            <td className={td}>{o.listings?.title}</td>
            <td className={td}>{money(o.amount_cents)}</td>
            <td className={td}>{money(o.fee_cents)}</td>
            <td className={td}>{o.status}</td>
            <td className={td}>{o.payout_status}</td>
            <td className={td}>
              {o.status === "paid" && (
                <form action={refund}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="text-danger underline">Refund</button>
                </form>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Listings({ q }: { q: string }) {
  let query = createAdminClient().from("listings").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data } = await query;
  return (
    <table className="card w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Listed</th>
          <th className={th}>Title</th>
          <th className={th}>Price</th>
          <th className={th}>Status</th>
          <th className={th} />
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {((data ?? []) as Listing[]).map((l) => (
          <tr key={l.id}>
            <td className={td}>{timeAgo(l.created_at)}</td>
            <td className={td}>
              <Link href={`/listing/${l.id}`} className="underline">
                {l.title}
              </Link>
            </td>
            <td className={td}>{money(l.price_cents)}</td>
            <td className={td}>{l.status}</td>
            <td className={td}>
              {l.status === "active" && (
                <form action={setListing}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value="removed" />
                  <button className="text-danger underline">Remove</button>
                </form>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Users({ q }: { q: string }) {
  let query = createAdminClient().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,company.ilike.%${q}%`);
  const { data } = await query;
  return (
    <table className="card w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Joined</th>
          <th className={th}>Name</th>
          <th className={th}>Company</th>
          <th className={th}>Trade</th>
          <th className={th}>Payouts</th>
          <th className={th} />
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {((data ?? []) as Profile[]).map((p) => (
          <tr key={p.id}>
            <td className={td}>{timeAgo(p.created_at)}</td>
            <td className={td}>
              {p.full_name} {p.role === "admin" && <span className="badge bg-accent-soft text-accent">admin</span>}
            </td>
            <td className={td}>{p.company}</td>
            <td className={td}>{p.trade}</td>
            <td className={td}>{p.payouts_enabled ? "yes" : "no"}</td>
            <td className={td}>
              <form action={setSuspended}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="suspended" value={String(!p.suspended)} />
                <button className={p.suspended ? "text-ok underline" : "text-danger underline"}>{p.suspended ? "Unsuspend" : "Suspend"}</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Reports() {
  const { data } = await createAdminClient().from("reports").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  if (!rows.length) return <p className="card p-6 text-center text-sm text-muted">No open reports.</p>;
  return (
    <table className="card w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>When</th>
          <th className={th}>About</th>
          <th className={th}>Reason</th>
          <th className={th} />
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td}>{timeAgo(r.created_at)}</td>
            <td className={td}>
              {r.listing_id ? (
                <Link href={`/listing/${r.listing_id}`} className="underline">
                  Listing
                </Link>
              ) : (
                <span>Order {String(r.order_id).slice(0, 8)}</span>
              )}
            </td>
            <td className={td}>{r.reason}</td>
            <td className={td}>
              <form action={resolveReport}>
                <input type="hidden" name="id" value={r.id} />
                <button className="underline">Resolve</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
