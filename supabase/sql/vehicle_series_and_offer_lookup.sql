alter table public.car_engines
  add column series_keys text[] not null default '{}';

-- The reviewed applications already name these chassis or generations.
update public.car_engines e set series_keys = v.series_keys
from public.car_models m, public.car_brands b, (values
  ('Audi', 'A1', '1.2 TFSI 85 PS (8X, CBZA)', array['8x']),
  ('BMW', '3er', '320d F30/F31 190 PS (B47D20A)', array['f30','f31']),
  ('BMW', '3er', '320d F30/F31 184 PS (N47D20C)', array['f30','f31']),
  ('Ford', 'Focus', 'Focus III 1.0 EcoBoost 100 PS (10FDOX Fox)', array['focus iii']),
  ('Hyundai', 'i30', 'i30 PD 1.6 CRDi 136 PS (D4FB)', array['pd']),
  ('Mazda', '3', 'Mazda 3 BL 2.0 MZR 150 PS (LF-5H)', array['bl']),
  ('Mercedes-Benz', 'C-Klasse', 'C 220 d W205 170 PS (OM 651.921)', array['w205']),
  ('Mercedes-Benz', 'GLC', 'GLC 220 d X253 170 PS (OM 651.921)', array['x253']),
  ('Nissan', 'Qashqai', 'Qashqai II 1.5 dCi 110 PS Euro 6 (K9K)', array['j11']),
  ('Opel', 'Corsa', 'Corsa E 1.4 90 PS (B14XEL, Schaltgetriebe)', array['corsa e']),
  ('Renault', 'Clio', 'Clio IV 0.9 TCe 90 PS (H4B400)', array['clio iv']),
  ('Toyota', 'Yaris', 'Yaris III 1.0 12V 69 PS (1KR-FE)', array['yaris iii']),
  ('Volkswagen', 'Golf', 'Golf VII 1.6 TDI 105 PS (5G1, 77 kW; Brems-PR prüfen)', array['golf vii']),
  ('Volkswagen', 'Golf', 'Golf VII 2.0 TDI 150 PS (CRBC) – mit Wassersensor', array['golf vii']),
  ('Volkswagen', 'Golf', 'Golf VII 2.0 TDI 150 PS (CRBC) – ohne Wassersensor', array['golf vii']),
  ('Volkswagen', 'Polo', 'Polo V 1.2 TSI 90 PS (6R/6C, CBZC)', array['polo v']),
  ('Volkswagen', 'Polo', 'Polo V 1.2 TSI 105 PS (6R/6C, CBZB)', array['polo v']),
  ('Volkswagen', 'Tiguan', 'Tiguan I 1.4 TSI 122 PS (5N, CAXA)', array['tiguan i']),
  ('Volkswagen', 'Touran', 'Touran 1T3 1.2 TSI 105 PS (CBZB)', array['1t3'])
) as v(make, model, designation, series_keys)
where e.model_id=m.id and m.brand_id=b.id
  and (b.name, m.name, e.designation)=(v.make, v.model, v.designation);

-- Manufacturer application and OE cross-references for the reviewed Golf oil filter.
do $$
declare
  application_url constant text := 'https://www.mann-filter.com/de-de/katalog/suchergebnisse/produkt.html/hu7020z_mann-filter.html';
  filter_id bigint;
begin
  insert into public.parts (manufacturer, part_name, manufacturer_part_number, category, source_url, verification_status)
  values ('MANN-FILTER', 'Ölfilter HU 7020 z', 'HU 7020 z', 'Ölfilter', application_url, 'verified')
  on conflict (manufacturer, manufacturer_part_number) do update
    set source_url=excluded.source_url, verification_status=excluded.verification_status
  returning id into filter_id;

  insert into public.part_fitments (part_id, engine_id, source_url, notes, status, verified_at)
  select filter_id, e.id, application_url,
    'Herstelleranwendung Golf VII (5G1/BA5), 2.0 TDI 110 kW, Motorkennbuchstabe CRBC, 11/2012 bis 08/2020. OE-Nummer und Motorcode am Fahrzeug abgleichen.',
    'verified', now()
  from public.car_engines e
  join public.car_models m on m.id=e.model_id
  join public.car_brands b on b.id=m.brand_id
  where b.name='Volkswagen' and m.name='Golf' and e.engine_code='CRBC'
    and 'golf vii'=any(e.series_keys)
  on conflict (part_id, engine_id) do nothing;

  insert into public.oe_numbers (part_id, oe_number, oe_brand, source_url)
  select filter_id, number, 'VW Group', application_url
  from unnest(array['03N 115 562', '03N 115 562 B', '03N 115 466']) as number
  on conflict (part_id, oe_number) do nothing;
end $$;

create table public.parts_merchant_lookup_budget (
  lookup_day date not null,
  query_hash text not null check (query_hash ~ '^[a-f0-9]{64}$'),
  checked_at timestamptz not null default now(),
  attempts smallint not null default 1 check (attempts between 1 and 100),
  primary key (lookup_day, query_hash)
);
alter table public.parts_merchant_lookup_budget enable row level security;
revoke all on public.parts_merchant_lookup_budget from public, anon, authenticated;
grant select, insert, update on public.parts_merchant_lookup_budget to service_role;

create function public.reserve_parts_merchant_lookup(key_hash text)
returns text language plpgsql security invoker set search_path='' as $$
declare
  day_utc date := (now() at time zone 'UTC')::date;
  previous timestamptz;
begin
  perform pg_advisory_xact_lock(514692704);
  select checked_at into previous from public.parts_merchant_lookup_budget
    where query_hash=key_hash and lookup_day=day_utc;
  if previous > now()-interval '30 seconds' then return 'busy'; end if;
  if previous > now()-interval '5 minutes' then return 'cooldown'; end if;
  if (select coalesce(sum(attempts),0) from public.parts_merchant_lookup_budget where lookup_day=day_utc)>=100
    then return 'quota';
  end if;
  insert into public.parts_merchant_lookup_budget(query_hash,lookup_day) values(key_hash,day_utc)
    on conflict(lookup_day,query_hash) do update
      set attempts=public.parts_merchant_lookup_budget.attempts+1,checked_at=now();
  return 'reserved';
end $$;
revoke all on function public.reserve_parts_merchant_lookup(text) from public,anon,authenticated;
grant execute on function public.reserve_parts_merchant_lookup(text) to service_role;
