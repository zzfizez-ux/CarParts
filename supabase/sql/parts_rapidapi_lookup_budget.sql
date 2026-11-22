create table public.parts_rapidapi_lookup_budget (
  checked_at timestamptz not null default now(),
  query_hash text not null check (query_hash ~ '^[a-f0-9]{64}$'),
  chargeable boolean not null default true,
  primary key (checked_at, query_hash)
);
create index parts_rapidapi_lookup_hash on public.parts_rapidapi_lookup_budget (query_hash, checked_at desc);
alter table public.parts_rapidapi_lookup_budget enable row level security;
revoke all on public.parts_rapidapi_lookup_budget from public, anon, authenticated;
grant select, insert, update on public.parts_rapidapi_lookup_budget to service_role;

-- CarParts keeps calls within the published Basic allowance and reuses cached results.
create function public.reserve_parts_rapidapi_lookup(key_hash text)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(514692705);
  if exists (
    select 1 from public.parts_rapidapi_lookup_budget
    where query_hash = key_hash and checked_at > now() - interval '2 minutes'
  ) then return 'cooldown';
  end if;
  if (
    select count(*) from public.parts_rapidapi_lookup_budget
    where checked_at > now() - interval '31 days'
      and chargeable
  ) >= 50 then return 'quota';
  end if;
  insert into public.parts_rapidapi_lookup_budget(query_hash) values (key_hash);
  return 'reserved';
end $$;
revoke all on function public.reserve_parts_rapidapi_lookup(text) from public, anon, authenticated;
grant execute on function public.reserve_parts_rapidapi_lookup(text) to service_role;

create function public.mark_parts_rapidapi_access_denied(key_hash text)
returns void language sql security invoker set search_path = '' as $$
  update public.parts_rapidapi_lookup_budget set chargeable = false
  where query_hash = key_hash and checked_at > now() - interval '2 minutes'
$$;
revoke all on function public.mark_parts_rapidapi_access_denied(text) from public, anon, authenticated;
grant execute on function public.mark_parts_rapidapi_access_denied(text) to service_role;
