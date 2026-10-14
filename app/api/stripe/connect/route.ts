import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mockPayments, siteUrl, stripe } from "@/lib/stripe";
import { processPendingPayouts } from "@/lib/orders";

/** Starts (or resumes) Stripe Express onboarding so the seller can be paid. */
export async function GET() {
  const { user, profile } = await getUser();
  if (!user || !profile) return NextResponse.redirect(`${siteUrl()}/login?next=/profile`);
  const db = createAdminClient();

  if (mockPayments()) {
    await db.from("profiles").update({ stripe_account_id: `mock_acct_${user.id.slice(0, 8)}`, payouts_enabled: true }).eq("id", user.id);
    await processPendingPayouts(user.id);
    return NextResponse.redirect(`${siteUrl()}/profile?payouts=1`);
  }

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: "CA",
      email: user.email || undefined,
      business_type: profile.company ? "company" : "individual",
      business_profile: { name: profile.company || undefined, mcc: "5211", product_description: "Construction surplus sold on TradeGrade" },
      capabilities: { transfers: { requested: true } },
      metadata: { user_id: user.id },
    });
    accountId = account.id;
    await db.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl()}/api/stripe/connect`,
    return_url: `${siteUrl()}/profile?payouts=1`,
  });
  return NextResponse.redirect(link.url);
}
