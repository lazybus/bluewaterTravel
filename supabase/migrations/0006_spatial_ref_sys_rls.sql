do $$
declare
  spatial_ref_sys_owner regrole;
begin
  if to_regclass('public.spatial_ref_sys') is null then
    return;
  end if;

  select c.relowner::regrole
  into spatial_ref_sys_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'spatial_ref_sys';

  if spatial_ref_sys_owner is distinct from current_user::regrole then
    raise notice
      'Skipping RLS change for public.spatial_ref_sys. Current role % does not own the table; owner is %.',
      current_user,
      spatial_ref_sys_owner;
    return;
  end if;

  execute 'alter table public.spatial_ref_sys enable row level security';

  execute 'drop policy if exists "spatial_ref_sys_read_all" on public.spatial_ref_sys';
  execute $policy$
    create policy "spatial_ref_sys_read_all"
    on public.spatial_ref_sys
    for select
    to anon, authenticated
    using (true)
  $policy$;
exception
  when insufficient_privilege then
    raise notice
      'Skipping RLS change for public.spatial_ref_sys because the executing role lacks ownership or required privileges.';
end
$$;