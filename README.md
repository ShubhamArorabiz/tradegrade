# TradeGrade

Toronto marketplace for construction surplus, built as an installable PWA.
A site super snaps a photo, Claude drafts the listing, a nearby contractor taps
Buy Now, and the seller is paid when they scan the buyer's QR pass at pickup.

Stack: Next.js 16 (App Router) · Supabase (Postgres + PostGIS, phone auth,
storage, realtime) · Stripe Checkout + Connect Express · Claude API · Cloudflare
Workers (via OpenNext) or Vercel.

**Test site:** [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md) puts a demo on tradegrade.ca with
`NEXT_PUBLIC_DEMO_MODE=1`: Stripe and Claude are simulated and testers use demo accounts.

## How the money moves

1. **Buy Now** reserves the listing for 30 minutes and opens Stripe Checkout.
   The card is charged to the TradeGrade platform account.
2. The webhook marks the order **paid**; the buyer gets a pickup pass
   (QR + 6-digit backup code) and the exact address.
3. At pickup the seller scans the pass. The server checks the code, marks the
   order **completed** and transfers the price minus the platform fee
   (`PLATFORM_FEE_PERCENT`, default 10%) to the seller's Stripe Express account.
   If the seller hasn't finished Stripe setup, the payout waits and is sent the
   moment their account is enabled.
4. No pickup within 72 h: full refund, listing goes back live (daily cron plus a
   check whenever the order is opened). Buyers can cancel within 1 hour; sellers
   can cancel any time before pickup.

The pickup code is an HMAC of the order id (`PICKUP_CODE_SECRET`), so it is
never stored where the seller could read it.

## Run it locally (no accounts needed)

Needs Node 22 and Docker.

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage, applies supabase/migrations
cp .env.example .env.local  # then paste the URL and keys `supabase start` prints
# add PAYMENTS_MODE=mock and AI_MODE=mock to fake Stripe and Claude
node scripts/seed.mjs       # 3 demo sellers, 9 listings around Toronto
npm run dev
```

Log in with 416 555 0101, 0102 or 0103 and code `123456` (test numbers set in
`supabase/config.toml`). 0101 is an admin (`/admin`).

## Going live on tradegrade.ca

1. **Supabase**: create a project (Canada region). In the SQL editor run
   `supabase/migrations/0001_init.sql`. Auth → Providers → Phone: enable and
   connect Twilio. Auth → URL configuration: site URL `https://tradegrade.ca`.
   Make yourself admin: `update profiles set role = 'admin' where id = '<your user id>';`
2. **Stripe**: enable Connect (Express, Canada). Developers → Webhooks → add
   `https://tradegrade.ca/api/stripe/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `account.updated`, and tick "listen to events on
   connected accounts" for `account.updated`. Turn on Apple Pay / Google Pay in
   payment methods.
3. **Anthropic**: create an API key at console.anthropic.com.
4. **Vercel**: import the repo, add every variable from `.env.example`
   (without the mock flags), deploy. Add the domain `tradegrade.ca` and point
   your DNS at Vercel as it instructs.

## Map of the code

| Path | What |
|---|---|
| `supabase/migrations/0001_init.sql` | Tables, RLS, radius search (`nearby_listings`), reservation lock |
| `lib/claude.ts`, `app/api/ai/draft` | Photo-to-listing with Claude (structured output, 20/day per user) |
| `app/sell/new` | Camera, "Claude is reading" screen, review form, Listed! |
| `app/api/checkout`, `app/api/stripe/*` | Buy Now, webhook, seller payout onboarding |
| `lib/orders.ts` | Payouts, refunds, completion, 72 h sweep, chat masking |
| `app/orders/[id]` | Pickup pass (buyer) / sale (seller), scan, chat |
| `app/admin` | Orders + refunds, listings, users (suspend), reports |
| `public/sw.js`, `app/manifest.ts` | PWA install, offline shell, pickup passes work offline |

## Not built yet

- Push and SMS alerts ("Sold: 40 sheets drywall") and the day-5 expiry reminder
- HST on sales for registered sellers
- Photo messages in chat; blocking free-item no-shows after 3 misses
- Editing a listing after posting (sellers take down and repost)
- Geocoding uses free OpenStreetMap Nominatim; switch to a paid geocoder with traffic
