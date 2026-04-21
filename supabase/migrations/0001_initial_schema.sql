create extension if not exists pgcrypto;
create extension if not exists postgis;

create type public.user_role as enum ('user', 'curator', 'admin');
create type public.trip_status as enum ('draft', 'active', 'archived');
create type public.trip_type as enum ('day_trip', 'multi_day');
create type public.trip_item_type as enum ('poi', 'meal', 'travel', 'note', 'reservation');
create type public.reservation_status as enum ('none', 'needed', 'booked');
create type public.sync_operation as enum ('insert', 'update', 'delete', 'reorder');
create type public.poi_kind as enum ('accommodation', 'food', 'activity', 'logistics', 'viewpoint');
create type public.warning_type as enum ('reservation', 'ferry', 'parking', 'weather', 'safety', 'seasonal', 'hours');
create type public.warning_severity as enum ('info', 'warning', 'critical');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'user',
  avatar_path text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_label text not null,
  platform text not null,
  app_version text,
  push_subscription jsonb,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  slug text unique,
  trip_type public.trip_type not null default 'day_trip',
  start_date date not null,
  end_date date not null,
  status public.trip_status not null default 'draft',
  trip_version bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  trip_date date not null,
  day_index integer not null,
  title text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, trip_date)
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  poi_id uuid,
  item_type public.trip_item_type not null default 'poi',
  title text,
  notes text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer,
  reservation_status public.reservation_status not null default 'none',
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_mutations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid not null references public.user_devices (id) on delete cascade,
  client_mutation_id text not null,
  base_trip_version bigint not null,
  entity_type text not null,
  entity_id uuid not null,
  operation public.sync_operation not null,
  payload jsonb not null default '{}'::jsonb,
  applied_trip_version bigint,
  created_at timestamptz not null default timezone('utc', now()),
  unique (device_id, client_mutation_id)
);

create table if not exists public.pois (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text,
  description text,
  poi_kind public.poi_kind not null,
  geom geography(point, 4326) not null,
  address text,
  municipality text,
  phone text,
  website text,
  booking_url text,
  is_published boolean not null default false,
  source text not null default 'curated',
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.poi_hours (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois (id) on delete cascade,
  season_label text not null,
  valid_from date,
  valid_to date,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  early_close_warning_minutes integer,
  closed boolean not null default false,
  notes text
);

create table if not exists public.poi_warnings (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois (id) on delete cascade,
  warning_type public.warning_type not null,
  severity public.warning_severity not null default 'warning',
  title text not null,
  message text not null,
  action_url text,
  requires_acknowledgement boolean not null default false,
  lead_time_hours integer,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_profiles (
  poi_id uuid primary key references public.pois (id) on delete cascade,
  default_duration_minutes integer not null,
  min_duration_minutes integer,
  max_duration_minutes integer,
  trail_difficulty text,
  distance_km numeric(6, 2),
  elevation_gain_m integer,
  crowd_intensity text,
  weather_sensitivity text
);

create table if not exists public.travel_time_edges (
  id uuid primary key default gen_random_uuid(),
  from_poi_id uuid not null references public.pois (id) on delete cascade,
  to_poi_id uuid not null references public.pois (id) on delete cascade,
  mode text not null default 'drive',
  duration_minutes integer not null,
  distance_km numeric(6, 2),
  source text not null default 'curated',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (from_poi_id, to_poi_id, mode)
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_type text not null,
  lead_minutes integer not null default 30,
  enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  trip_item_id uuid references public.trip_items (id) on delete cascade,
  rule_type text not null,
  title text not null,
  body text not null,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  status text not null default 'queued',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_trips_user_id on public.trips (user_id);
create index if not exists idx_trip_days_trip_id on public.trip_days (trip_id);
create index if not exists idx_trip_items_trip_day_id on public.trip_items (trip_day_id);
create index if not exists idx_trip_mutations_trip_id on public.trip_mutations (trip_id);
create index if not exists idx_pois_geom on public.pois using gist (geom);
create index if not exists idx_pois_kind_published on public.pois (poi_kind, is_published);

alter table public.profiles enable row level security;
alter table public.user_devices enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_mutations enable row level security;
alter table public.pois enable row level security;
alter table public.poi_hours enable row level security;
alter table public.poi_warnings enable row level security;
alter table public.activity_profiles enable row level security;
alter table public.travel_time_edges enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notifications enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'user_role')::public.user_role, 'user'::public.user_role)
$$;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (id = auth.uid() or public.current_user_role() = 'admin')
with check (id = auth.uid() or public.current_user_role() = 'admin');

create policy "devices_manage_own"
on public.user_devices
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "trips_manage_own"
on public.trips
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "trip_days_manage_own"
on public.trip_days
for all
using (
  exists (
    select 1
    from public.trips
    where public.trips.id = public.trip_days.trip_id
      and public.trips.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trips
    where public.trips.id = public.trip_days.trip_id
      and public.trips.user_id = auth.uid()
  )
);

create policy "trip_items_manage_own"
on public.trip_items
for all
using (
  exists (
    select 1
    from public.trip_days
    join public.trips on public.trips.id = public.trip_days.trip_id
    where public.trip_days.id = public.trip_items.trip_day_id
      and public.trips.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trip_days
    join public.trips on public.trips.id = public.trip_days.trip_id
    where public.trip_days.id = public.trip_items.trip_day_id
      and public.trips.user_id = auth.uid()
  )
);

create policy "trip_mutations_manage_own"
on public.trip_mutations
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "pois_read_published"
on public.pois
for select
using (is_published or public.current_user_role() in ('curator', 'admin'));

create policy "pois_write_curator"
on public.pois
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "poi_hours_read_all"
on public.poi_hours
for select
using (true);

create policy "poi_hours_write_curator"
on public.poi_hours
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "poi_warnings_read_all"
on public.poi_warnings
for select
using (true);

create policy "poi_warnings_write_curator"
on public.poi_warnings
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "activity_profiles_read_all"
on public.activity_profiles
for select
using (true);

create policy "activity_profiles_write_curator"
on public.activity_profiles
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "travel_edges_read_all"
on public.travel_time_edges
for select
using (true);

create policy "travel_edges_write_curator"
on public.travel_time_edges
for all
using (public.current_user_role() in ('curator', 'admin'))
with check (public.current_user_role() in ('curator', 'admin'));

create policy "notification_rules_manage_own"
on public.notification_rules
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_read_own"
on public.notifications
for select
using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();