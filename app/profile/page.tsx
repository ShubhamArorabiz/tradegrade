import Link from "next/link";
import { BadgeCheck, ChevronRight, LogOut, Package, Shield, Star, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mockPayments, stripe } from "@/lib/stripe";
import { processPendingPayouts } from "@/lib/orders";
import { platformFeePercent } from "@/lib/constants";
import type { SellerStats } from "@/lib/types";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ payouts?: string }> }) {
  const { payouts } = await searchParams;
  const { user, profile } = await requireUser("/profile");
  const db = createAdminClient();

  // Coming back from Stripe onboarding: don't wait for the webhook.
  if (payouts && profile.stripe_account_id && !profile.payouts_enabled && !mockPayments()) {
    const account = await stripe().accounts.retrieve(profile.stripe_account_id).catch(() => null);
    if (account?.payouts_enabled && account.details_submitted) {
      await db.from("profiles").update({ payouts_enabled: true }).eq("id", user.id);
      profile.payouts_enabled = true;
      await processPendingPayouts(user.id);
    }
  }

  const { data: stats } = await db.from("seller_stats").select("*").eq("id", user.id).single<SellerStats>();

  return (
    <main className="with-tabs">
      <div className="page pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-accent bg-surface text-2xl font-extrabold text-accent">
            {(profile.full_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 text-[22px] font-extrabold tracking-[-0.02em]">
              {profile.full_name}
              {stats?.verified_business && <BadgeCheck size={20} className="text-accent" aria-label="Verified business" />}
            </h1>
            <p className="text-[13px] text-muted">{[profile.company, profile.trade].filter(Boolean).join(" · ") || user.phone || user.email}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-faint">
              <Star size={13} className={stats?.rating_count ? "fill-warn text-warn" : ""} />
              {stats?.rating_count ? `${stats.rating_avg.toFixed(1)} (${stats.rating_count})` : "No ratings yet"} · {stats?.completed_sales ?? 0} sales
            </p>
          </div>
        </div>

        <div className="card mt-6 divide-y divide-line">
          <Row href="/orders" icon={<Package size={19} />} label="Orders and pickup passes" />
          <Row
            href="/api/stripe/connect"
            icon={<Wallet size={19} />}
            label="Payouts"
            detail={profile.payouts_enabled ? "Connected" : profile.stripe_account_id ? "Finish setup" : "Set up"}
            warn={!profile.payouts_enabled}
          />
          {profile.role === "admin" && <Row href="/admin" icon={<Shield size={19} />} label="Admin" />}
        </div>
        {payouts && profile.payouts_enabled && <p className="mt-3 text-sm text-ok">Payouts are set up. You&apos;ll be paid when buyers pick up.</p>}
        <p className="mt-3 text-[12px] text-faint">
          TradeGrade keeps {platformFeePercent()}% of each paid sale. Free items cost nothing. Add your company name and connect payouts to get the Verified business badge.
        </p>

        <h2 className="mt-8 text-[20px] font-extrabold tracking-[-0.02em]">Your details</h2>
        <ProfileForm userId={user.id} initial={{ full_name: profile.full_name ?? "", company: profile.company ?? "", trade: profile.trade ?? "" }} />

        <form action="/auth/signout" method="post" className="mt-8">
          <button className="btn-ghost w-full justify-start px-0 text-danger">
            <LogOut size={17} /> Log out
          </button>
        </form>
      </div>
    </main>
  );
}

function Row({ href, icon, label, detail, warn }: { href: string; icon: React.ReactNode; label: string; detail?: string; warn?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      {detail && <span className={`text-sm ${warn ? "text-warn" : "text-ok"}`}>{detail}</span>}
      <ChevronRight size={18} className="text-faint" />
    </Link>
  );
}
