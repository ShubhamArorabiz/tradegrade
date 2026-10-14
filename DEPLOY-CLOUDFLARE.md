# Put the TradeGrade test site on tradegrade.ca

This runs the app on Cloudflare (free) with a free Supabase database. Claude and
payments are simulated, so you need no Stripe account and no Anthropic key.
Testers sign in with the **Try as a buyer** and **Try as a seller** buttons.

You need: your Cloudflare account (where tradegrade.ca is), your GitHub account
with the `tradegrade` repo, and about 20 minutes.

## 1. Make up four secret values

Make four long random strings, for example with a password manager's generator
(20+ characters, letters and numbers). Keep them in a note for the next steps.

| Name | What it's for |
| --- | --- |
| `DEMO_ADMIN_PASSWORD` | Your password for the admin account `admin@tradegrade.ca` |
| `DEMO_SETUP_KEY` | Used once to load the sample listings |
| `PICKUP_CODE_SECRET` | Makes the pickup codes |
| `CRON_SECRET` | Protects the cleanup job |

## 2. Create the free database (Supabase)

1. Go to **supabase.com**, click **Start your project** and sign up (you can use "Continue with GitHub").
2. Click **New project**. Name it `tradegrade`, set a database password (save it in your note),
   pick the region **Canada (Central)**, keep the **Free** plan, and click **Create new project**.
   Wait until it says the project is ready.
3. In the left menu open **SQL Editor**, then **New query**.
4. Open this file in a new tab and copy everything in it:
   `https://github.com/ShubhamArorabiz/tradegrade/blob/main/supabase/migrations/0001_init.sql`
   (click the **Copy raw file** button at the top right of the file).
5. Paste it into the SQL Editor and click **Run**. It should say "Success. No rows returned".
6. Open **Project Settings → API Keys** (and **Project Settings → Data API** for the URL). Copy these three into your note:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_`)
   - **Secret key** (starts with `sb_secret_`, click **Reveal**). Treat it like a password.

## 3. Connect the repo in Cloudflare

1. Go to **dash.cloudflare.com** and open **Compute (Workers) → Workers & Pages**.
2. Click **Create**, then **Import a repository**, and connect GitHub if asked. Pick the **tradegrade** repo.
3. On the setup screen:
   - **Project name:** `tradegrade` (it must be exactly this)
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - Open **Advanced settings → Build variables** and add these four:

     | Name | Value |
     | --- | --- |
     | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Publishable key |
     | `NEXT_PUBLIC_SITE_URL` | `https://tradegrade.ca` |
     | `NEXT_PUBLIC_DEMO_MODE` | `1` |

4. Click **Deploy** and wait for the build to finish (a few minutes).

## 4. Add the secret settings

1. Open the **tradegrade** worker, then **Settings → Variables and Secrets**.
2. Click **Add** for each of these. Choose type **Secret** for every one:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Secret key from Supabase |
   | `DEMO_ADMIN_PASSWORD` | from your note |
   | `DEMO_SETUP_KEY` | from your note |
   | `PICKUP_CODE_SECRET` | from your note |
   | `CRON_SECRET` | from your note |

3. Click **Deploy** (or **Save and deploy**).

## 5. Point tradegrade.ca at it

1. Still in the worker, open **Settings → Domains & Routes**, click **Add**, choose **Custom domain**.
2. Type `tradegrade.ca` and click **Add domain**. Do the same for `www.tradegrade.ca` if you want it.
3. If Cloudflare says a DNS record already exists for that name (for example a parking page),
   go to **tradegrade.ca → DNS → Records**, delete that `A`, `AAAA` or `CNAME` record for `tradegrade.ca`, and try again.
   Cloudflare adds the right record and the HTTPS certificate by itself. It can take a few minutes.

## 6. Load the sample listings (once)

Open this address in your browser, with your own setup key at the end:

`https://tradegrade.ca/api/demo/setup?key=YOUR_DEMO_SETUP_KEY`

You should see `{"ok":true,"accounts":3,"listings":9}`. Then open **https://tradegrade.ca**.

- **Try as a buyer** and **Try as a seller** sign in to shared demo accounts.
- For the admin view, use **Sign in with email and password** with `admin@tradegrade.ca` and your `DEMO_ADMIN_PASSWORD`.

## Good to know

- Every push to `main` on GitHub redeploys the site automatically.
- Supabase pauses free projects after a week with no visits. If the site shows no listings,
  open supabase.com, select the project and click **Restore**.
- Cloudflare's free plan limits how much work each page load can do. If you ever see
  "Error 1102" or "Worker exceeded resource limits", switch Workers to the **Paid** plan
  ($5 USD a month) under **Workers & Pages → Plans**.
- When you go live for real, you'll add the Stripe and Anthropic keys and turn `NEXT_PUBLIC_DEMO_MODE` off. The README covers that.
