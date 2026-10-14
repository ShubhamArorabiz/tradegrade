import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function stripe() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** PAYMENTS_MODE=mock fakes Stripe for local testing without an account. */
export function mockPayments() {
  return process.env.PAYMENTS_MODE === "mock";
}
