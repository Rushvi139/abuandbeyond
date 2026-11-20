-- The new pizza and burger menu (20 Nov 2026), with add-ons, half-and-half
-- pizzas, the category lines, and the three offer banners.
--
--  * New items are added (or updated, if this has run before) by SKU.
--  * Older pizzas and burgers not on the new list are hidden, not deleted:
--    past orders keep pointing at them, and /admin can switch any back on.
--  * Chicken add-ons go on non-veg items only, so a veg dish stays veg.
--
-- PREVIEW (changes nothing):
--   docker compose exec -T db psql -U abu -d abuandbeyond -f - < scripts/one-off/menu-pizza-burger-2026-11-20.sql
-- APPLY:
--   docker compose exec -T db psql -U abu -d abuandbeyond -v apply=1 -f - < scripts/one-off/menu-pizza-burger-2026-11-20.sql

\set ON_ERROR_STOP on
\pset pager off
begin;

-- ---------------------------------------------------------------- categories
do $$ begin
  if not exists (select 1 from categories where slug = 'pizza') then raise exception 'No category with slug "pizza"'; end if;
  if not exists (select 1 from categories where slug = 'burgers') then raise exception 'No category with slug "burgers"'; end if;
end $$;

update categories set blurb = E'Slow-fermented for 72 hours. Handcrafted. Freshly baked. Always delicious.\nOnion-free, garlic-free marinara. Jain pizzas on request. 10-inch, 8 slices.', active = true where slug = 'pizza';
update categories set blurb = 'Fresh homemade brioche buns. Fresh lettuce. Stacked to order. Every burger is served with a side of fries.', active = true where slug = 'burgers';

-- Half & half sits right after Pizza.
do $$ declare p int; begin
  if not exists (select 1 from categories where slug = 'half-and-half-pizza') then
    select sort_order into p from categories where slug = 'pizza';
    update categories set sort_order = sort_order + 1 where sort_order > p;
    insert into categories (name, slug, sort_order, blurb) values ('Half & Half Pizza', 'half-and-half-pizza', p + 1,
      E'Can\'t decide? Pick any two flavours on one pizza. Each half is charged at half the menu price of that pizza, plus ₹99 extra.\nVeg with veg, non-veg with non-veg. The Chicken Dominator is whole only.');
  end if;
end $$;

-- ---------------------------------------------------------------- items
create temp table new_items (sku text, cat text, name text, slug text, veg boolean, price int, descr text,
  station text, cuisine cuisine_sticker, kit text, sort int) on commit drop;
insert into new_items values
 ('PZ01','pizza','Margherita Bella','margherita-bella',true,399,'Fresh homemade marinara, mozzarella, fresh basil. Jain.','pizza_oven','italy','pizza',1),
 ('PZ02','pizza','Tandoori Paneer Sunrise','tandoori-paneer-sunrise',true,449,'Fresh homemade marinara, smoky tandoori paneer, onions, bell peppers, mozzarella, mint mayo.','pizza_oven','italy','pizza',2),
 ('PZ03','pizza','Indiano Garden','indiano-garden',true,449,'Fresh homemade marinara, mozzarella, onions, bell peppers, olives, mushrooms, broccoli. Jain on request.','pizza_oven','italy','pizza',3),
 ('PZ04','pizza','Smokehouse BBQ Paneer','smokehouse-bbq-paneer',true,449,'Fresh homemade marinara, smoky BBQ paneer, bell peppers, onions, melted mozzarella.','pizza_oven','italy','pizza',4),
 ('PZ05','pizza','Four Cheese Quattro','four-cheese-quattro',true,599,'Fresh homemade marinara, mozzarella, parmesan, feta, creamy liquid cheese, Italian herbs. Jain.','pizza_oven','italy','pizza',5),
 ('PZ06','pizza','Golden Mushroom Melt','golden-mushroom-melt',true,499,'Fresh homemade marinara, button mushrooms, mozzarella, sweet caramelised onions.','pizza_oven','italy','pizza',6),
 ('PZ07','pizza','Pesto Pomodoro','pesto-pomodoro',true,499,'Basil pesto base, cherry tomatoes, sun-dried tomatoes, mozzarella, parmesan.','pizza_oven','italy','pizza',7),
 ('PZ08','pizza','Al Funghi Bianca','al-funghi-bianca',true,549,'Button mushrooms and caramelised onions in a creamy white sauce, topped with mozzarella.','pizza_oven','italy','pizza',8),
 ('PZ09','pizza','Tandoori Chicken Sunrise','tandoori-chicken-sunrise',false,549,'Fresh homemade marinara, tandoori chicken cubes, onions, bell peppers, mozzarella, mint mayo.','pizza_oven','italy','pizza',9),
 ('PZ10','pizza','Smokehouse BBQ Chicken','smokehouse-bbq-chicken-pizza',false,549,'Fresh homemade marinara, BBQ-marinated chicken, bell peppers, onions, mozzarella.','pizza_oven','italy','pizza',10),
 ('PZ11','pizza','The Chicken Dominator','the-chicken-dominator',false,699,'Fresh homemade marinara, BBQ chicken, crispy katsu chicken, chicken meatballs, tandoori chicken, onions, bell peppers.','pizza_oven','italy','pizza',11),
 ('PZ12','pizza','Rosemary Chicken Verde','rosemary-chicken-verde',false,599,'Basil pesto base, rosemary-marinated chicken, cherry tomatoes, sun-dried tomatoes, mozzarella, parmesan.','pizza_oven','italy','pizza',12),
 ('PZHHV','half-and-half-pizza','Half & Half Pizza (Veg)','half-and-half-pizza-veg',true,99,'Any two veg pizzas on one. Each half at half its menu price, plus ₹99.','pizza_oven','italy','pizza',1),
 ('PZHHN','half-and-half-pizza','Half & Half Pizza (Non-Veg)','half-and-half-pizza-non-veg',false,99,'Any two non-veg pizzas on one. Each half at half its menu price, plus ₹99.','pizza_oven','italy','pizza',2),
 ('BG01','burgers','Golden Aloo Crunch','golden-aloo-crunch',true,249,'Crispy aloo patty, thousand island sauce, fresh lettuce, caramelised onion, fresh tomato, jalapeños, cheese. With fries.','grill_rolls','abu','box_wrap',1),
 ('BG02','burgers','Cheesy Shroom Stack','cheesy-shroom-stack',true,299,'Crispy aloo patty, thousand island sauce, fresh lettuce, caramelised onion, fresh tomato, jalapeños, cheese, topped with a creamy sautéed mushroom mix. With fries.','grill_rolls','abu','box_wrap',2),
 ('BG03','burgers','Southern Fried Chicken','southern-fried-chicken',false,349,'Mint mayo and garlic sauce base, fresh lettuce, crispy chicken breast, jalapeños, tomato slice, liquid cheese. With fries.','grill_rolls','abu','box_wrap',3),
 ('BG04','burgers','Smokehouse BBQ Chicken','smokehouse-bbq-chicken-burger',false,329,'Chicken patty grilled in BBQ sauce, fresh lettuce, mustard mayo, caramelised onion, fresh tomato, jalapeños, cheese. With fries.','grill_rolls','abu','box_wrap',4);

-- A slug already used by some other dish would stop the run; say which.
do $$ declare clash text; begin
  select string_agg(n.slug, ', ') into clash from new_items n join menu_items m on m.slug = n.slug and m.sku <> n.sku;
  if clash is not null then raise exception 'Slug already used by another dish: %', clash; end if;
end $$;

insert into menu_items (sku, slug, name, description, category_id, station_id, cuisine, is_veg, price_paise, pack_kit_id, price_status, sort_order, active, available)
select n.sku, n.slug, n.name, n.descr, c.id, n.station, n.cuisine, n.veg, n.price * 100, n.kit, 'new', n.sort, true, true
from new_items n join categories c on c.slug = n.cat
on conflict (sku) do update set name = excluded.name, description = excluded.description, category_id = excluded.category_id,
  is_veg = excluded.is_veg, price_paise = excluded.price_paise, sort_order = excluded.sort_order, active = true, updated_at = now();

\echo
\echo '=== Older pizzas and burgers that will be HIDDEN (not deleted) ==='
select m.sku, m.name, (m.price_paise / 100) as price_inr from menu_items m join categories c on c.id = m.category_id
where c.slug in ('pizza', 'burgers') and m.active and m.sku not in (select sku from new_items) order by c.slug, m.name;

update menu_items m set active = false, updated_at = now() from categories c
where c.id = m.category_id and c.slug in ('pizza', 'burgers') and m.active and m.sku not in (select sku from new_items);

-- ---------------------------------------------------------------- half & half choices
create temp table halves on commit drop as
select case when n.veg then 'PZHHV' else 'PZHHN' end as hh, n.name, n.price, n.sort
from new_items n where n.cat = 'pizza' and n.sku <> 'PZ11';

insert into option_groups (menu_item_id, name, required, max_choices, sort_order)
select m.id, g.name, true, 1, g.s from menu_items m cross join (values ('First half', 1), ('Second half', 2)) g(name, s)
where m.sku in ('PZHHV', 'PZHHN') and not exists (select 1 from option_groups x where x.menu_item_id = m.id and x.name = g.name);

insert into options (option_group_id, name, price_delta_paise, sort_order)
select g.id, h.name, ceil(h.price / 2.0)::int * 100, h.sort
from halves h join menu_items m on m.sku = h.hh join option_groups g on g.menu_item_id = m.id and g.name in ('First half', 'Second half')
where not exists (select 1 from options o where o.option_group_id = g.id and o.name = h.name);

update options o set price_delta_paise = ceil(h.price / 2.0)::int * 100, active = true
from halves h join menu_items m on m.sku = h.hh join option_groups g on g.menu_item_id = m.id
where o.option_group_id = g.id and o.name = h.name;

-- ---------------------------------------------------------------- add-ons
create temp table new_addons (name text, price int, veg boolean, scope text) on commit drop;
-- scope: pizza = every pizza; pizza_nv = non-veg pizzas only; burger / burger_nv likewise.
insert into new_addons values
 ('Extra mozzarella',79,true,'pizza'), ('Liquid cheese drizzle',79,true,'pizza'), ('Parmesan shower',119,true,'pizza'),
 ('Tandoori paneer',99,true,'pizza'), ('BBQ paneer',99,true,'pizza'),
 ('Tandoori chicken',159,false,'pizza_nv'), ('BBQ chicken',159,false,'pizza_nv'), ('Crispy chicken',159,false,'pizza_nv'),
 ('Jalapeños',49,true,'pizza'), ('Olives',49,true,'pizza'), ('Onions',49,true,'pizza'), ('Bell peppers',49,true,'pizza'),
 ('Mushrooms',49,true,'pizza'), ('Broccoli',49,true,'pizza'),
 ('Extra cheese slice',49,true,'burger'), ('Creamy sautéed mushrooms',79,true,'burger'), ('Crispy chicken breast',159,false,'burger_nv');

\echo '=== Add-ons that already exist under the same name (their price will change to the new one) ==='
select a.name, a.price_paise / 100 as old_inr, n.price as new_inr from addons a join new_addons n on n.name = a.name where a.price_paise <> n.price * 100;

insert into addons (name, price_paise, is_veg, active) select name, price * 100, veg, true from new_addons
on conflict (name) do update set price_paise = excluded.price_paise, is_veg = excluded.is_veg, active = true;

-- Links rebuilt for the new items only, so a rerun gives the same result.
delete from menu_item_addons where menu_item_id in (select m.id from menu_items m join new_items n on n.sku = m.sku);
insert into menu_item_addons (menu_item_id, addon_id)
select m.id, a.id from new_items n join menu_items m on m.sku = n.sku
join new_addons na on (n.cat in ('pizza', 'half-and-half-pizza') and (na.scope = 'pizza' or (na.scope = 'pizza_nv' and not n.veg)))
                   or (n.cat = 'burgers' and (na.scope = 'burger' or (na.scope = 'burger_nv' and not n.veg)))
join addons a on a.name = na.name
on conflict do nothing;

-- ---------------------------------------------------------------- banners
insert into banners (title, subtitle, link_url, image_path, tone, sort_order, placement, cta_label, active)
select * from (values
  ('72 hours fermented', 'Try our New York style pizza', '/#pizza', '/brand/stickers/bear-pizza.png', 'ink', 1, 'card', 'Order pizza', true),
  ('Free iced tea', 'On orders above ₹699', null, null, 'acid', 2, 'card', null, true),
  ('First time in Mount Abu', 'Fresh homemade brioche buns', '/#burgers', '/brand/stickers/burgers.png', 'clay', 3, 'card', 'See burgers', true)
) v(title, subtitle, link_url, image_path, tone, sort_order, placement, cta_label, active)
where not exists (select 1 from banners b where b.title = v.title);

\echo '=== Banners live after this (top of the menu, in this order) ==='
select sort_order, title, subtitle, placement from banners where active order by placement, sort_order, created_at desc;

\echo '=== New menu ==='
select c.name as category, m.name, m.price_paise / 100 as price_inr, case when m.is_veg then 'veg' else 'non-veg' end as type,
  (select count(*) from menu_item_addons x where x.menu_item_id = m.id) as addons
from menu_items m join categories c on c.id = m.category_id join new_items n on n.sku = m.sku order by c.sort_order, m.sort_order;

\if :{?apply}
  commit;
  \echo 'DONE: new pizza and burger menu is live.'
\else
  rollback;
  \echo 'PREVIEW ONLY: nothing was changed. Run again with -v apply=1 to do it.'
\endif
