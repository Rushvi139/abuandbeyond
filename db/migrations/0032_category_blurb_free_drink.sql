-- A line under a category heading on the menu ("Slow-fermented for 72 hours…").
alter table categories add column if not exists blurb text;

-- Free iced tea on orders whose food total reaches this many paise. Delete the
-- row (or set it to 0) to switch the offer off.
insert into settings (key, value) values ('free_drink_min_paise', '69900'::jsonb)
on conflict (key) do nothing;
