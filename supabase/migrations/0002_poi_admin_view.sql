create or replace view public.poi_admin_view as
select
  id,
  slug,
  name,
  summary,
  description,
  poi_kind,
  st_y(geom::geometry) as latitude,
  st_x(geom::geometry) as longitude,
  address,
  municipality,
  phone,
  website,
  booking_url,
  is_published,
  source,
  created_at,
  updated_at
from public.pois;