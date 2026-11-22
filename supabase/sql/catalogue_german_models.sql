-- Additional vehicles with a public manufacturer application in the catalogue batches.
with additions(make, model) as (
  values ('Alpina', 'D3'), ('Borgward', 'Isabella'), ('DKW', 'F12'),
    ('Isdera', 'Imperator 108i'), ('MAN', 'TGE'), ('Maybach', '57'), ('Maybach', '62'),
    ('Mercedes-AMG', 'S-Class'), ('NSU', 'Ro 80'), ('Trabant', '601'),
    ('Wartburg', '1.3'), ('Wiesmann', 'Roadster')
)
insert into public.car_brands(name)
  select distinct make from additions
  on conflict (name) do nothing;

with additions(make, model) as (
  values ('Alpina', 'D3'), ('Borgward', 'Isabella'), ('DKW', 'F12'),
    ('Isdera', 'Imperator 108i'), ('MAN', 'TGE'), ('Maybach', '57'), ('Maybach', '62'),
    ('Mercedes-AMG', 'S-Class'), ('NSU', 'Ro 80'), ('Trabant', '601'),
    ('Wartburg', '1.3'), ('Wiesmann', 'Roadster')
)
insert into public.car_models(brand_id, name)
  select b.id, a.model from additions a join public.car_brands b on b.name = a.make
  on conflict (brand_id, name) do nothing;
