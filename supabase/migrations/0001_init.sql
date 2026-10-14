-- TradeGrade MVP schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Server-side code uses the service role for every money or status change;
-- browsers only read through RLS and edit their own profile and listings.

create extension if not exists postgis with schema extensions;

-- ── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text,
  trade text,
  role text not null default 'user' check (role in ('user', 'admin')),
  suspended boolean not null default false,
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit name / company / trade only.
create function public.protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.role := old.role;
    new.suspended := old.suspended;
    new.stripe_account_id := old.stripe_account_id;
    new.payouts_enabled := old.payouts_enabled;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ── Listings ───────────────────────────────────────────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null,
  condition text not null default 'new' check (condition in ('new', 'like_new', 'used', 'salvage')),
  grade text check (grade in ('structural', 'non_structural', 'scrap')),
  specs jsonb not null default '{}',
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null default 'lot',
  -- $0 means free; otherwise $5 to $25,000
  price_cents integer not null default 0
    check (price_cents = 0 or price_cents between 500 and 2500000),
  loading text not null default 'hand' check (loading in ('hand', 'forklift', 'truck')),
  photos text[] not null check (cardinality(photos) between 1 and 5),
  location extensions.geography (point, 4326) not null,
  lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  area_label text,              -- public, approximate ("Liberty Village")
  pickup_address text,          -- private until purchase
  pickup_notes text,            -- private until purchase (gate code, hours)
  status text not null default 'active' check (status in ('active', 'reserved', 'sold', 'removed')),
  reserved_until timestamptz,
  ai_draft jsonb,               -- Claude's untouched draft, to measure edits
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create index listings_location_idx on public.listings using gist (location);
create index listings_status_idx on public.listings (status, expires_at);
create index listings_seller_idx on public.listings (seller_id, created_at desc);

-- Sellers edit, remove or relist while the listing is active or expired;
-- once a buyer has it, only the server changes it.
create function public.protect_listing_fields() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.status in ('reserved', 'sold') then
      raise exception 'This listing has a buyer and can no longer be edited';
    end if;
    if new.status not in ('active', 'removed') then
      raise exception 'Invalid status';
    end if;
    if new.expires_at > now() + interval '7 days 1 minute' then
      raise exception 'Listings run for at most 7 days';
    end if;
    new.seller_id := old.seller_id;
    new.reserved_until := old.reserved_until;
    new.ai_draft := old.ai_draft;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger listings_protect before update on public.listings
  for each row execute function public.protect_listing_fields();

-- ── Orders ─────────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id),
  buyer_id uuid not null references public.profiles (id),
  seller_id uuid not null references public.profiles (id),
  amount_cents integer not null,
  fee_cents integer not null,
  -- pending = checkout open; paid = waiting for pickup
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
  payout_status text not null default 'none'
    check (payout_status in ('none', 'waiting_for_seller', 'paid_out', 'failed')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  as_is_accepted_at timestamptz not null,
  pickup_deadline timestamptz,
  pickup_attempts integer not null default 0,
  cancel_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  completed_at timestamptz
);

create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_deadline_idx on public.orders (status, pickup_deadline);

-- ── Messages (order chat) ──────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index messages_order_idx on public.messages (order_id, created_at);

-- ── Ratings, reports, AI usage ─────────────────────────────────────────────
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_id uuid not null references public.profiles (id),
  to_id uuid not null references public.profiles (id),
  stars smallint not null check (stars between 1 and 5),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (order_id, from_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  listing_id uuid references public.listings (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at);

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Sellers read and manage their own listings directly. Everyone else reads
-- listings through listing_cards / nearby_listings, which leave out the address.
create policy "own listings read" on public.listings for select using (auth.uid() = seller_id);
create policy "own listings insert" on public.listings for insert
  with check (
    auth.uid() = seller_id
    and status = 'active'
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended)
  );
create policy "own listings update" on public.listings for update
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

create policy "order parties read" on public.orders for select
  using (auth.uid() in (buyer_id, seller_id));

create policy "message parties read" on public.messages for select
  using (exists (select 1 from public.orders o
                 where o.id = order_id and auth.uid() in (o.buyer_id, o.seller_id)));

create policy "ratings readable" on public.ratings for select using (true);

-- ── Public views and functions ─────────────────────────────────────────────
create view public.seller_stats as
  select p.id,
         coalesce(round(avg(r.stars)::numeric, 1), 0)::double precision as rating_avg,
         count(r.id)::integer as rating_count,
         (select count(*) from public.orders o where o.seller_id = p.id and o.status = 'completed')::integer as completed_sales,
         (p.company is not null and p.company <> '' and p.payouts_enabled) as verified_business
  from public.profiles p
  left join public.ratings r on r.to_id = p.id
  group by p.id;

grant select on public.seller_stats to anon, authenticated;

-- Listing detail without the pickup address. Coordinates are rounded to
-- about 500 m so the exact spot stays private until purchase.
create view public.listing_cards as
  select l.id, l.seller_id, l.title, l.description, l.category, l.condition, l.grade,
         l.specs, l.quantity, l.unit, l.price_cents, l.loading, l.photos, l.area_label,
         l.status, l.expires_at, l.created_at, (l.ai_draft is not null) as ai_assisted,
         round(extensions.st_y(l.location::extensions.geometry)::numeric, 2)::double precision as lat,
         round(extensions.st_x(l.location::extensions.geometry)::numeric, 2)::double precision as lng,
         p.company as seller_company, p.full_name as seller_name
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status <> 'removed' and not p.suspended;

grant select on public.listing_cards to anon, authenticated;

create function public.nearby_listings(
  lat double precision,
  lng double precision,
  radius_km double precision default 10,
  q text default null,
  cat text default null,
  free_only boolean default false,
  max_price_cents integer default null,
  cond text default null,
  max_rows integer default 60
) returns table (
  id uuid, title text, category text, condition text, quantity numeric, unit text,
  price_cents integer, photos text[], area_label text, created_at timestamptz,
  seller_company text, verified_business boolean, distance_km double precision,
  approx_lat double precision, approx_lng double precision
)
-- Parameters are qualified with the function name: listings has lat/lng columns too.
language sql stable security definer set search_path = public, extensions as $$
  select l.id, l.title, l.category, l.condition, l.quantity, l.unit,
         l.price_cents, l.photos, l.area_label, l.created_at, p.company,
         (p.company is not null and p.company <> '' and p.payouts_enabled),
         round((st_distance(l.location, st_makepoint(nearby_listings.lng, nearby_listings.lat)::geography) / 1000)::numeric, 1)::double precision,
         round(st_y(l.location::geometry)::numeric, 2)::double precision,
         round(st_x(l.location::geometry)::numeric, 2)::double precision
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'active'
    and l.expires_at > now()
    and not p.suspended
    and st_dwithin(l.location, st_makepoint(nearby_listings.lng, nearby_listings.lat)::geography, nearby_listings.radius_km * 1000)
    and (nearby_listings.cat is null or l.category = nearby_listings.cat)
    and (nearby_listings.cond is null or l.condition = nearby_listings.cond)
    and (not free_only or l.price_cents = 0)
    and (max_price_cents is null or l.price_cents <= max_price_cents)
    and (nearby_listings.q is null or l.title ilike '%' || nearby_listings.q || '%' or l.description ilike '%' || nearby_listings.q || '%'
         or l.category ilike '%' || nearby_listings.q || '%')
  order by l.location <-> st_makepoint(nearby_listings.lng, nearby_listings.lat)::geography
  limit least(max_rows, 200);
$$;

grant execute on function public.nearby_listings to anon, authenticated;

-- Atomically reserve a listing for one buyer. Returns true if the caller got it.
create function public.reserve_listing(listing uuid, minutes integer default 30)
returns boolean language sql security definer set search_path = public as $$
  with r as (
    update public.listings
       set status = 'reserved', reserved_until = now() + make_interval(mins => minutes)
     where id = listing
       and (status = 'active' or (status = 'reserved' and reserved_until < now()))
       and expires_at > now()
    returning 1
  ) select exists (select 1 from r);
$$;

revoke execute on function public.reserve_listing from public, anon, authenticated;

-- ── Photo storage ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live order chat
alter publication supabase_realtime add table public.messages;
