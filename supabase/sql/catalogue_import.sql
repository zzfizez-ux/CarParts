-- Part-specific restrictions refine the vehicle application for newly imported rows.
alter table public.part_fitments
  add column year_from smallint,
  add column year_to smallint,
  add column series_keys text[],
  add column source_kind text,
  add column license_basis text,
  add constraint part_fitments_year_range check (
    (year_from is null or year_from between 1886 and 2100) and
    (year_to is null or year_to between 1886 and 2100) and
    (year_from is null or year_to is null or year_from <= year_to)
  );

create unique index car_engines_model_designation_uidx
  on public.car_engines(model_id, designation);

create or replace function public.import_catalogue_batch(records jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  asset jsonb;
  years_from smallint;
  years_to smallint;
  keys text[];
  model_key bigint;
  current_engine public.car_engines%rowtype;
  article_id bigint;
begin
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) not between 1 and 1000 then
    raise exception 'Expected 1–1000 reviewed catalogue rows';
  end if;

  -- Serialize the small writes per batch, including imports of shared articles.
  perform pg_advisory_xact_lock(hashtextextended('carparts catalogue batch import', 0));
  for item in select value from jsonb_array_elements(records) loop
    years_from := (item->>'year_from')::smallint;
    years_to := (item->>'year_to')::smallint;
    keys := array(select distinct value from jsonb_array_elements_text(item->'series_keys') order by value);
    if item->'reviewed' is distinct from 'true'::jsonb
      or coalesce(item->>'source_type', '') not in ('manufacturer_application', 'licensed_feed')
      or (item->>'source_type' = 'licensed_feed' and nullif(btrim(item->>'license_basis'), '') is null)
      or coalesce(item->>'source_url', '') !~ '^https://[^/]+/'
      or length(coalesce(btrim(item->>'fitment_notes'), '')) < 35
      or years_from is null or years_to is null or years_from > years_to
      or cardinality(keys) = 0 or exists (
        select 1 from unnest(keys) as k(value) where k.value !~ '^[a-z0-9]+( [a-z0-9]+)*$'
      ) then
      raise exception 'Missing catalogue application evidence for %', item->>'manufacturer_part_number';
    end if;

    select m.id into model_key from public.car_models m join public.car_brands b on b.id = m.brand_id
      where b.name = item->>'make' and m.name = item->>'model';
    if model_key is null then
      raise exception 'Unknown vehicle model % %', item->>'make', item->>'model';
    end if;

    insert into public.car_engines(model_id, designation, engine_code, fuel_type, year_from, year_to, series_keys)
      values (model_key, item->>'designation', nullif(item->>'engine_code',''), nullif(item->>'fuel_type',''),
        coalesce((item->>'engine_year_from')::smallint, years_from),
        coalesce((item->>'engine_year_to')::smallint, years_to), keys)
      on conflict (model_id, designation) do nothing;
    select * into strict current_engine from public.car_engines e
      where e.model_id = model_key and e.designation = item->>'designation';
    if not keys <@ current_engine.series_keys
      or current_engine.engine_code is distinct from nullif(item->>'engine_code','')
      or years_from < current_engine.year_from or years_to > current_engine.year_to then
      raise exception 'Application outside the recorded vehicle variant %', current_engine.designation;
    end if;

    insert into public.parts as part(manufacturer, manufacturer_part_number, part_name, category, source_url, verification_status)
      values (item->>'manufacturer', item->>'manufacturer_part_number', item->>'part_name', item->>'category',
        coalesce(item->>'article_url', item->>'source_url'), 'verified')
      on conflict (manufacturer, manufacturer_part_number) do update set
        part_name = excluded.part_name, category = excluded.category,
        source_url = coalesce(part.source_url, excluded.source_url), verification_status = 'verified'
      returning id into article_id;

    insert into public.part_fitments(part_id, engine_id, notes, source_url, status, verified_at,
      year_from, year_to, series_keys, source_kind, license_basis)
      values (article_id, current_engine.id, item->>'fitment_notes', item->>'source_url', 'verified', now(),
        years_from, years_to, keys, item->>'source_type', item->>'license_basis')
      on conflict (part_id, engine_id) do update set notes = excluded.notes, source_url = excluded.source_url,
        status = excluded.status, verified_at = excluded.verified_at, year_from = excluded.year_from,
        year_to = excluded.year_to, series_keys = excluded.series_keys, source_kind = excluded.source_kind,
        license_basis = excluded.license_basis;

    for asset in select value from jsonb_array_elements(coalesce(item->'oe_numbers','[]'::jsonb)) loop
      insert into public.oe_numbers(part_id, oe_number, oe_brand, source_url)
        values (article_id, asset->>'number', asset->>'manufacturer', coalesce(asset->>'source_url', item->>'source_url'))
        on conflict (part_id, oe_number) do nothing;
    end loop;

    for asset in select value from jsonb_array_elements(coalesce(item->'images','[]'::jsonb)) loop
      insert into public.part_images(part_id, image_url, source_url, reuse_permission, alt_text, verified_for_display)
        values (article_id, asset->>'image_url', asset->>'source_url', asset->>'reuse_permission', asset->>'alt_text', true)
        on conflict (part_id, image_url) do update set source_url = excluded.source_url,
          reuse_permission = excluded.reuse_permission, alt_text = excluded.alt_text, verified_for_display = true;
    end loop;

    for asset in select value from jsonb_array_elements(coalesce(item->'offers','[]'::jsonb)) loop
      if not (asset->>'price_amount')::numeric > 0
        or (asset->>'observed_at')::timestamptz > now() + interval '5 minutes' then
        raise exception 'Invalid observation for %', asset->>'product_url';
      end if;
      insert into public.part_offers as offer(part_id, merchant_name, product_url, price_amount, currency,
        availability, observed_at, source_url, verification_status)
        values (article_id, asset->>'merchant_name', asset->>'product_url', (asset->>'price_amount')::numeric,
          asset->>'currency', asset->>'availability', (asset->>'observed_at')::timestamptz, asset->>'source_url', 'verified')
        on conflict (part_id, merchant_name, product_url) do update set price_amount = excluded.price_amount,
          currency = excluded.currency, availability = excluded.availability, observed_at = excluded.observed_at,
          source_url = excluded.source_url, verification_status = 'verified'
        where excluded.observed_at >= offer.observed_at;
    end loop;
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(records));
end;
$$;

revoke all on function public.import_catalogue_batch(jsonb) from public, anon, authenticated;
grant execute on function public.import_catalogue_batch(jsonb) to service_role;
