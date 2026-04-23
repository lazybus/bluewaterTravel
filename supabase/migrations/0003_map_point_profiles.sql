create table if not exists public.food_profiles (
  poi_id uuid primary key references public.pois (id) on delete cascade,
  cuisine_types text[] not null default '{}',
  dining_style text,
  price_band text,
  menu_url text,
  patio boolean not null default false,
  takeout_available boolean not null default false,
  reservation_recommended boolean not null default false
);

create table if not exists public.accommodation_profiles (
  poi_id uuid primary key references public.pois (id) on delete cascade,
  accommodation_type text,
  capacity_min integer,
  capacity_max integer,
  roofed boolean not null default false,
  glamping boolean not null default false,
  camping boolean not null default false,
  direct_booking boolean not null default false
);

create table if not exists public.logistics_profiles (
  poi_id uuid primary key references public.pois (id) on delete cascade,
  logistics_type text,
  fuel_types text[] not null default '{}',
  charger_types text[] not null default '{}',
  potable_water boolean not null default false,
  seasonal_notes text
);

create table if not exists public.poi_media (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois (id) on delete cascade,
  image_url text not null,
  alt_text text,
  caption text,
  is_thumbnail boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_poi_media_poi_id on public.poi_media (poi_id, sort_order);

alter table public.food_profiles enable row level security;
alter table public.accommodation_profiles enable row level security;
alter table public.logistics_profiles enable row level security;
alter table public.poi_media enable row level security;

create policy "food_profiles_read_all"
on public.food_profiles
for select
using (true);

create policy "food_profiles_write_curator"
on public.food_profiles
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "accommodation_profiles_read_all"
on public.accommodation_profiles
for select
using (true);

create policy "accommodation_profiles_write_curator"
on public.accommodation_profiles
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "logistics_profiles_read_all"
on public.logistics_profiles
for select
using (true);

create policy "logistics_profiles_write_curator"
on public.logistics_profiles
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "poi_media_read_all"
on public.poi_media
for select
using (true);

create policy "poi_media_write_curator"
on public.poi_media
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));