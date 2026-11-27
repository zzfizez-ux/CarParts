create table public.shared_parts_research (
  query_hash text primary key check (query_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  checked_at timestamptz not null,
  expires_at timestamptz not null
);
alter table public.shared_parts_research enable row level security;
revoke all on public.shared_parts_research from public, anon, authenticated;
grant select, insert, update on public.shared_parts_research to service_role;

alter table public.live_web_search_budget add column attempts smallint not null default 1 check(attempts between 1 and 25);

-- Serialize only the short reservation transaction, never the provider request.
create function public.reserve_parts_web_lookup(key_hash text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  day_utc date := (now() at time zone 'UTC')::date;
  previous timestamptz;
  previous_attempts smallint;
begin
  perform pg_advisory_xact_lock(514692703);
  select checked_at,attempts into previous,previous_attempts from public.live_web_search_budget
   where query_hash=key_hash and lookup_day=day_utc;
  if previous > now()-interval '30 seconds' then return 'busy'; end if;
  if previous > now()-interval '5 minutes' then return 'quota'; end if;
  if coalesce(previous_attempts,0)>=25 then return 'quota'; end if;
  if (select coalesce(sum(attempts),0) from public.live_web_search_budget where lookup_day=day_utc)>=50 then return 'quota'; end if;
  insert into public.live_web_search_budget(query_hash,lookup_day) values(key_hash,day_utc)
   on conflict(query_hash,lookup_day) do update set attempts=public.live_web_search_budget.attempts+1,checked_at=now();
  return 'reserved';
end $$;
revoke all on function public.reserve_parts_web_lookup(text) from public,anon,authenticated;
grant execute on function public.reserve_parts_web_lookup(text) to service_role;
