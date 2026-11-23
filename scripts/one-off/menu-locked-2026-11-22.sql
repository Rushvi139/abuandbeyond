-- The locked menu (22 Nov 2026): every dish on the Standard Recipes sheet
-- (83 dishes; add-ons are already in).
--
--  * A dish already on the site is matched by its slug or name and LEFT AS IT
--    IS: price, photo, add-ons and description stay what the owner typed.
--    A matched dish that was hidden comes back on.
--  * A new dish with a price on the sheet is added and shown.
--  * A new dish with no price yet is added OFF the menu. In /admin/menu →
--    "Off the menu" it shows a price box: type the price, it goes live.
--  * New sections are added after the ones you already have, in this order:
--    Indian Non-Veg, Indian Veg, Indian Rolls, Dal Rice & Biryani, Breads,
--    Chinese, Raita Papad & Lassi. Reorder any time in Admin → Menu.
--  * Dishes on the site that are not on the locked menu are only LISTED.
--    Run with -v retire=1 as well to take them off (hidden, never deleted).
--
-- PREVIEW (changes nothing, prints what would happen):
--   docker compose exec -T db psql -U abu -d abuandbeyond -f - < scripts/one-off/menu-locked-2026-11-22.sql
-- APPLY:
--   docker compose exec -T db psql -U abu -d abuandbeyond -v apply=1 -f - < scripts/one-off/menu-locked-2026-11-22.sql
-- APPLY and take the old dishes off:
--   docker compose exec -T db psql -U abu -d abuandbeyond -v apply=1 -v retire=1 -f - < scripts/one-off/menu-locked-2026-11-22.sql

\set ON_ERROR_STOP on
\pset pager off
begin;

create temp table locked (sort int, cat_rank int, cat text, name text, slug text, veg boolean, price int, descr text,
  station text, cuisine cuisine_sticker, alias text) on commit drop;
insert into locked values
 (1, 1, 'Pizza', 'Margherita Bella', 'margherita-bella', true, 399, 'Fresh homemade marinara, mozzarella, fresh basil. Jain.', 'pizza_oven', 'italy', NULL),
 (2, 1, 'Pizza', 'Indiano Garden', 'indiano-garden', true, 449, 'Marinara, mozzarella, onions, bell peppers, olives, mushrooms, broccoli.', 'pizza_oven', 'italy', NULL),
 (3, 1, 'Pizza', 'Smokehouse BBQ Paneer', 'smokehouse-bbq-paneer', true, 449, 'Marinara, smoky BBQ paneer, bell peppers, onions, melted mozzarella.', 'pizza_oven', 'italy', NULL),
 (4, 1, 'Pizza', 'Four Cheese Quattro', 'four-cheese-quattro', true, 599, 'Marinara, mozzarella, parmesan, feta and a creamy liquid cheese drizzle.', 'pizza_oven', 'italy', NULL),
 (5, 1, 'Pizza', 'Pesto Pomodoro', 'pesto-pomodoro', true, 499, 'Basil pesto base, cherry tomatoes, sun-dried tomatoes, mozzarella, parmesan.', 'pizza_oven', 'italy', NULL),
 (6, 1, 'Pizza', 'Al Funghi Bianca', 'al-funghi-bianca', true, 549, 'Mushrooms and caramelised onions in creamy white sauce, mozzarella.', 'pizza_oven', 'italy', NULL),
 (7, 1, 'Pizza', 'Smokehouse BBQ Chicken Pizza', 'smokehouse-bbq-chicken-pizza', false, 549, 'Marinara, BBQ chicken, bell peppers, onions, mozzarella.', 'pizza_oven', 'italy', NULL),
 (8, 1, 'Pizza', 'The Chicken Dominator', 'the-chicken-dominator', false, 699, 'BBQ chicken, crispy chicken, chicken meatballs, onions, bell peppers, mozzarella.', 'pizza_oven', 'italy', NULL),
 (9, 1, 'Pizza', 'Rosemary Chicken Pesto Pomodoro', 'rosemary-chicken-pesto-pomodoro', false, 599, 'Pesto base, rosemary chicken, cherry and sun-dried tomatoes, parmesan.', 'pizza_oven', 'italy', 'rosemary-chicken-verde'),
 (22, 2, 'Pasta', 'Arrabbiata Pasta', 'arrabbiata-pasta', true, 239, 'Penne in a spicy tomato sauce with garlic, chilli flakes, basil, parmesan.', 'wok_momos', 'italy', NULL),
 (23, 2, 'Pasta', 'Alfredo Pasta', 'alfredo-pasta', true, 269, 'Penne in a creamy white cheese sauce, parmesan.', 'wok_momos', 'italy', NULL),
 (24, 2, 'Pasta', 'Mix (Pink) Pasta', 'mix-pink-pasta', true, 199, 'Penne in a creamy pink tomato-cream sauce.', 'wok_momos', 'italy', NULL),
 (25, 2, 'Pasta', 'Pesto Pasta', 'pesto-pasta', true, 259, 'Penne in creamy basil pesto, parmesan.', 'wok_momos', 'italy', NULL),
 (26, 2, 'Pasta', 'Aglio Olio', 'aglio-olio', true, 199, 'Spaghetti with golden garlic, olive oil, chilli flakes, parmesan.', 'wok_momos', 'italy', NULL),
 (27, 3, 'Focaccia', 'Rosemary Chicken Pesto Focaccia', 'rosemary-chicken-pesto-focaccia', false, NULL, 'Rosemary focaccia, pesto, seared chicken, mozzarella, lettuce, tomato.', 'pizza_oven', 'italy', NULL),
 (28, 3, 'Focaccia', 'Paneer Pesto Focaccia', 'paneer-pesto-focaccia', true, NULL, 'Focaccia, pesto, seared paneer, mozzarella, lettuce, tomato.', 'pizza_oven', 'italy', NULL),
 (29, 3, 'Focaccia', 'L&T Classic Focaccia', 'landt-classic-focaccia', true, NULL, 'Focaccia, peri peri mayo, lettuce, tomato, mozzarella.', 'pizza_oven', 'italy', NULL),
 (30, 3, 'Focaccia', 'Chicken L&T Classic Focaccia', 'chicken-landt-classic-focaccia', false, NULL, 'Focaccia, chicken, peri peri mayo, lettuce, tomato, mozzarella.', 'pizza_oven', 'italy', NULL),
 (31, 5, 'Laffa Rolls', 'Falafel Laffa Roll', 'falafel-laffa-roll', true, 249, 'Crunchy falafel, hummus, salad and pickles in fresh laffa.', 'grill_rolls', 'lebanon', NULL),
 (32, 12, 'Dal, Rice & Biryani', 'Dal Rice', 'dal-rice', true, NULL, 'Home-style tadka dal with steamed basmati.', 'wok_momos', 'abu', NULL),
 (33, 6, 'Bowls', 'Falafel Hummus Platter with Fresh Pita', 'falafel-hummus-platter-with-fresh-pita', true, 279, 'Six falafel, hummus, salad, pickles and warm pita.', 'fryer', 'lebanon', NULL),
 (34, 7, 'Burgers', 'Golden Aloo Crunch', 'golden-aloo-crunch', true, 249, 'Crispy aloo patty, thousand island, lettuce, caramelised onion, tomato, cheese. With fries.', 'grill_rolls', 'abu', NULL),
 (35, 7, 'Burgers', 'Southern Fried Chicken', 'southern-fried-chicken', false, 349, 'Crispy chicken breast, mint mayo, garlic sauce, lettuce, jalapeño, liquid cheese. With fries.', 'grill_rolls', 'abu', NULL),
 (36, 7, 'Burgers', 'Smokehouse BBQ Chicken Burger', 'smokehouse-bbq-chicken-burger', false, 329, 'BBQ chicken patty, mustard mayo, caramelised onion, lettuce, tomato, cheese. With fries.', 'grill_rolls', 'abu', NULL),
 (40, 8, 'Fries', 'Salted Fries', 'salted-fries', true, 139, 'Golden 9 mm fries, salted, with ketchup.', 'fryer', 'abu', 'fries'),
 (41, 8, 'Fries', 'Peri Peri Fries', 'peri-peri-fries', true, NULL, 'Golden fries tossed in peri peri, with ketchup.', 'fryer', 'abu', NULL),
 (42, 8, 'Fries', 'Tandoori Fries', 'tandoori-fries', true, NULL, 'Golden fries tossed in tandoori masala, with ketchup.', 'fryer', 'abu', NULL),
 (43, 4, 'Garlic Bread', 'Cheese Garlic Bread', 'cheese-garlic-bread', true, 169, 'Six fingers of garlic butter bread with melted mozzarella.', 'pizza_oven', 'italy', NULL),
 (44, 16, 'Iced Tea', 'Peach Iced Tea', 'peach-iced-tea', true, 99, '400 ml peach iced tea with lemon.', 'cold_drinks', 'abu', NULL),
 (45, 16, 'Iced Tea', 'Lemon Iced Tea', 'lemon-iced-tea', true, 99, '400 ml lemon iced tea with mint.', 'cold_drinks', 'abu', NULL),
 (46, 16, 'Iced Tea', 'Blue Lagoon', 'blue-lagoon', true, 99, '400 ml blue curaçao and lemon soda.', 'cold_drinks', 'abu', NULL),
 (47, 17, 'Shakes', 'Oreo Shake', 'oreo-shake', true, 169, 'Oreo blended with vanilla ice cream and milk.', 'cold_drinks', 'abu', NULL),
 (48, 17, 'Shakes', 'Nutella Shake', 'nutella-shake', true, 219, 'Nutella blended with vanilla ice cream and milk.', 'cold_drinks', 'abu', NULL),
 (49, 17, 'Shakes', 'Peanut Butter Banana Shake', 'peanut-butter-banana-shake', true, NULL, 'Peanut butter and banana with vanilla ice cream.', 'cold_drinks', 'abu', NULL),
 (50, 12, 'Dal, Rice & Biryani', 'Steamed Rice', 'steamed-rice', true, NULL, 'Plain steamed basmati.', 'wok_momos', 'abu', NULL),
 (51, 12, 'Dal, Rice & Biryani', 'Jeera Rice', 'jeera-rice', true, NULL, 'Basmati tossed with ghee and jeera.', 'wok_momos', 'abu', NULL),
 (52, 12, 'Dal, Rice & Biryani', 'Veg Biryani', 'veg-biryani', true, NULL, 'Dum biryani with vegetables and paneer, saffron basmati. With raita.', 'wok_momos', 'abu', NULL),
 (53, 12, 'Dal, Rice & Biryani', 'Anda Biryani', 'anda-biryani', false, NULL, 'Dum biryani with masala eggs, saffron basmati. With raita.', 'wok_momos', 'abu', NULL),
 (54, 12, 'Dal, Rice & Biryani', 'Chicken Biryani', 'chicken-biryani', false, NULL, 'Dum biryani with bone-in chicken, saffron basmati. With raita.', 'wok_momos', 'abu', NULL),
 (55, 12, 'Dal, Rice & Biryani', 'Mutton Biryani', 'mutton-biryani', false, NULL, 'Dum biryani with tender mutton, saffron basmati. With raita.', 'wok_momos', 'abu', NULL),
 (56, 12, 'Dal, Rice & Biryani', 'Dal Khichdi', 'dal-khichdi', true, NULL, 'Soft moong dal khichdi with peas and ghee.', 'wok_momos', 'abu', NULL),
 (57, 9, 'Indian Non-Veg', 'Anda Butter Masala', 'anda-butter-masala', false, NULL, 'Three eggs in rich makhani gravy with butter and cream.', 'wok_momos', 'abu', NULL),
 (58, 15, 'Raita, Papad & Lassi', 'Roasted Papad', 'roasted-papad', true, NULL, 'Two roasted papads.', 'cold_drinks', 'abu', NULL),
 (59, 15, 'Raita, Papad & Lassi', 'Fried Papad', 'fried-papad', true, NULL, 'Two fried papads.', 'cold_drinks', 'abu', NULL),
 (60, 15, 'Raita, Papad & Lassi', 'Plain Raita', 'plain-raita', true, NULL, 'Chilled curd with roasted jeera.', 'cold_drinks', 'abu', NULL),
 (61, 15, 'Raita, Papad & Lassi', 'Veg Raita', 'veg-raita', true, NULL, 'Curd with cucumber, onion and tomato.', 'cold_drinks', 'abu', NULL),
 (62, 15, 'Raita, Papad & Lassi', 'Sweet Lassi', 'sweet-lassi', true, NULL, '300 ml sweet lassi.', 'cold_drinks', 'abu', NULL),
 (63, 15, 'Raita, Papad & Lassi', 'Salted Lassi', 'salted-lassi', true, NULL, '300 ml salted lassi with jeera and mint.', 'cold_drinks', 'abu', NULL),
 (64, 5, 'Laffa Rolls', 'Crispy Chicken Laffa Roll', 'crispy-chicken-laffa-roll', false, 279, 'Crispy chicken, garlic sauce, peri peri mayo, lettuce, tomato, pickles in fresh laffa.', 'grill_rolls', 'lebanon', NULL),
 (65, 5, 'Laffa Rolls', 'Pesto Chicken Laffa Roll', 'pesto-chicken-laffa-roll', false, NULL, 'Seared chicken, pesto, mozzarella, lettuce, tomato, onion in toasted laffa.', 'grill_rolls', 'lebanon', NULL),
 (66, 5, 'Laffa Rolls', 'Pesto Paneer Laffa Roll', 'pesto-paneer-laffa-roll', true, 239, 'Seared paneer, pesto, mozzarella, lettuce, tomato, onion in toasted laffa.', 'grill_rolls', 'lebanon', NULL),
 (67, 11, 'Indian Rolls', 'Butter Chicken Roll', 'butter-chicken-roll', false, NULL, 'Tikka chicken in makhani gravy, onion, lettuce, mint mayo in a flaky Malabar parotta.', 'grill_rolls', 'abu', NULL),
 (68, 11, 'Indian Rolls', 'Tripple Egg Cheese Roll', 'tripple-egg-cheese-roll', false, NULL, 'Three-egg omelette, melted cheese, onion, chilli, mint mayo in a Malabar parotta.', 'grill_rolls', 'abu', NULL),
 (69, 11, 'Indian Rolls', 'Ghee Chicken Bhuna Roll', 'ghee-chicken-bhuna-roll', false, NULL, 'Ghee-roasted bhuna chicken, onion, green chutney in a Malabar parotta.', 'grill_rolls', 'abu', NULL),
 (70, 11, 'Indian Rolls', 'Paneer Lababdar Roll', 'paneer-lababdar-roll', true, NULL, 'Paneer and peppers in lababdar gravy, mint mayo in a Malabar parotta.', 'grill_rolls', 'abu', NULL),
 (71, 11, 'Indian Rolls', 'Southern Fried Chicken Wrap', 'southern-fried-chicken-wrap', false, NULL, 'Crispy chicken, mint mayo, garlic sauce, lettuce, jalapeño, liquid cheese.', 'grill_rolls', 'abu', NULL),
 (72, 17, 'Shakes', 'Classic Cold Coffee', 'classic-cold-coffee', true, NULL, 'Thick cold coffee blended with vanilla ice cream.', 'cold_drinks', 'abu', NULL),
 (73, 9, 'Indian Non-Veg', 'Kerala Style Mutton Ghee Roast', 'kerala-style-mutton-ghee-roast', false, NULL, 'Mutton slow-roasted in ghee with a red chilli and tamarind masala, curry leaves.', 'wok_momos', 'abu', NULL),
 (74, 9, 'Indian Non-Veg', 'Dhaba Style Chicken Curry', 'dhaba-style-chicken-curry', false, NULL, 'Bone-in chicken in a rustic onion-tomato gravy.', 'wok_momos', 'abu', NULL),
 (75, 9, 'Indian Non-Veg', 'Butter Chicken', 'butter-chicken', false, NULL, 'Charred chicken tikka in silky makhani gravy with butter and cream.', 'wok_momos', 'abu', NULL),
 (76, 9, 'Indian Non-Veg', 'Shikampuri Shammi Kebab', 'shikampuri-shammi-kebab', false, NULL, 'Four mutton kebabs with a creamy hung-curd centre, mint chutney.', 'grill_rolls', 'abu', NULL),
 (77, 9, 'Indian Non-Veg', 'Amritsari Mutton Tikka (Bhuna)', 'amritsari-mutton-tikka-bhuna', false, NULL, 'Mustard-oil marinated mutton, charred and tossed in bhuna masala.', 'grill_rolls', 'abu', NULL),
 (78, 9, 'Indian Non-Veg', 'Amritsari Murgh Tikka', 'amritsari-murgh-tikka', false, NULL, 'Six pieces of charred Amritsari chicken tikka, mint chutney.', 'grill_rolls', 'abu', NULL),
 (79, 9, 'Indian Non-Veg', 'Dahiwala Chicken', 'dahiwala-chicken', false, NULL, 'Boneless chicken cooked in a thick spiced curd masala.', 'grill_rolls', 'abu', NULL),
 (80, 10, 'Indian Veg', 'Dhaba Style Sev Tamatar', 'dhaba-style-sev-tamatar', true, NULL, 'Tangy tomato gravy with crisp sev on top.', 'wok_momos', 'abu', NULL),
 (81, 10, 'Indian Veg', 'Veg Tawa Masala', 'veg-tawa-masala', true, NULL, 'Charred vegetables tossed on the tawa in a thick masala.', 'wok_momos', 'abu', NULL),
 (82, 10, 'Indian Veg', 'Paneer Lababdar', 'paneer-lababdar', true, NULL, 'Paneer, onion and peppers in a rich creamy gravy.', 'wok_momos', 'abu', NULL),
 (83, 10, 'Indian Veg', 'Paneer Bhurji (Milk Based)', 'paneer-bhurji-milk-based', true, NULL, 'Soft, creamy paneer bhurji made with milk.', 'wok_momos', 'abu', NULL),
 (84, 10, 'Indian Veg', 'Chhole with Choice of Bread', 'chhole-with-choice-of-bread', true, NULL, 'Spicy Punjabi chhole with your pick of bread.', 'wok_momos', 'abu', NULL),
 (85, 10, 'Indian Veg', 'Paneer Koliwada', 'paneer-koliwada', true, NULL, 'Crisp spiced batter-fried paneer with curry leaves, mint chutney.', 'fryer', 'abu', NULL),
 (86, 10, 'Indian Veg', 'Cheese Stuffed Harabhara Kebab', 'cheese-stuffed-harabhara-kebab', true, NULL, 'Six spinach and pea kebabs with a melting cheese centre.', 'fryer', 'abu', NULL),
 (87, 10, 'Indian Veg', 'Chana Garlic Chaat', 'chana-garlic-chaat', true, NULL, 'Garlic-butter chickpeas with onion, tomato, lemon and sev.', 'fryer', 'abu', NULL),
 (88, 12, 'Dal, Rice & Biryani', 'Dal Fry Dabbawali', 'dal-fry-dabbawali', true, NULL, 'Toor dal with a sizzling ghee, garlic and red chilli tadka.', 'wok_momos', 'abu', NULL),
 (89, 14, 'Chinese', 'Thai Chilly Chicken', 'thai-chilly-chicken', false, NULL, 'Crispy chicken tossed in sweet Thai chilli sauce with peppers and basil.', 'wok_momos', 'china', NULL),
 (90, 14, 'Chinese', 'Thai Chilly Paneer', 'thai-chilly-paneer', true, NULL, 'Crispy paneer tossed in sweet Thai chilli sauce with peppers and basil.', 'wok_momos', 'china', NULL),
 (91, 14, 'Chinese', 'Veg Manchurian', 'veg-manchurian', true, NULL, 'Vegetable manchurian in a glossy soy-garlic gravy.', 'wok_momos', 'china', NULL),
 (92, 14, 'Chinese', 'Burnt Garlic Noodles (Veg)', 'burnt-garlic-noodles-veg', true, NULL, 'Hakka noodles with vegetables and crispy burnt garlic.', 'wok_momos', 'china', NULL),
 (93, 14, 'Chinese', 'Burnt Garlic Noodles (Chicken)', 'burnt-garlic-noodles-chicken', false, NULL, 'Hakka noodles with chicken, vegetables and crispy burnt garlic.', 'wok_momos', 'china', NULL),
 (94, 14, 'Chinese', 'Burnt Garlic Rice (Veg)', 'burnt-garlic-rice-veg', true, NULL, 'Fried rice with vegetables and crispy burnt garlic.', 'wok_momos', 'china', NULL),
 (95, 14, 'Chinese', 'Burnt Garlic Rice (Chicken)', 'burnt-garlic-rice-chicken', false, NULL, 'Fried rice with chicken, vegetables and crispy burnt garlic.', 'wok_momos', 'china', NULL),
 (96, 13, 'Breads', 'Malabar Parantha', 'malabar-parantha', true, NULL, 'One flaky layered Malabar parotta.', 'grill_rolls', 'abu', NULL),
 (97, 13, 'Breads', 'Ghar ka Parantha', 'ghar-ka-parantha', true, NULL, 'One home-style layered parantha.', 'grill_rolls', 'abu', NULL),
 (98, 13, 'Breads', 'Tawa Roti', 'tawa-roti', true, NULL, 'One tawa roti with ghee.', 'grill_rolls', 'abu', NULL);

create temp table matched on commit drop as
select l.*, (
  select x.id from menu_items x
  where x.slug = l.slug or lower(x.name) = lower(l.name) or (l.alias is not null and x.slug = l.alias)
  order by (x.slug = l.slug) desc, x.active desc limit 1) as live_id
from locked l;

\echo
\echo '== 1. Already on the site: kept exactly as they are =='
select l.name as "locked menu", x.name as "on the site", x.price_paise / 100 as "₹ now",
  case when x.active then 'showing' when x.price_paise >= 100 then 'hidden → comes back on' else 'hidden, no price' end as "status"
from matched l join menu_items x on x.id = l.live_id order by l.sort;

\echo '== 2. New, added and SHOWN (price from the sheet) =='
select name as dish, cat as section, price as "₹" from matched where live_id is null and price is not null order by sort;

\echo '== 3. New, added OFF the menu until you type a price in Admin → Menu → Off the menu =='
select name as dish, cat as section from matched where live_id is null and price is null order by sort;

\echo '== 4. On the site now but NOT on the locked menu (taken off only with -v retire=1) =='
select x.name as dish, c.name as section, x.price_paise / 100 as "₹"
from menu_items x join categories c on c.id = x.category_id
where x.active and x.id not in (select live_id from matched where live_id is not null) order by c.sort_order, x.name;

-- ---------------------------------------------------------------- changes
insert into categories (name, slug, sort_order)
select n.cat, regexp_replace(regexp_replace(lower(replace(n.cat, '&', 'and')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'),
  (select coalesce(max(sort_order), 0) from categories) + row_number() over (order by n.first)
from (select cat, min(cat_rank) as first from locked group by cat) n
where not exists (select 1 from categories c where lower(c.name) = lower(n.cat))
on conflict (slug) do update set active = true;
update categories c set active = true from (select distinct cat from locked) l where lower(c.name) = lower(l.cat);

-- known renames (the dish is the same, the sheet has the new name)
update menu_items x set name = l.name, updated_at = now()
from matched l where l.alias is not null and x.id = l.live_id and x.slug = l.alias and x.name <> l.name;

-- matched but hidden, with a real price: back on
update menu_items x set active = true, available = true, updated_at = now()
from matched l where x.id = l.live_id and not x.active and x.price_paise >= 100
  and (to_jsonb(x) ->> 'archived_at') is null;  -- removed forever in Admin: stays gone

do $$ declare clash text; begin
  select string_agg(l.slug, ', ') into clash from matched l join menu_items x on x.slug = l.slug where l.live_id is null;
  if clash is not null then raise exception 'Slug already used by another dish: %', clash; end if;
end $$;

insert into menu_items (sku, slug, name, description, category_id, station_id, cuisine, is_veg, price_paise,
  price_status, sort_order, active, available)
select 'LM' || lpad(l.sort::text, 3, '0') || '-' || substr(md5(l.slug), 1, 3), l.slug, l.name, l.descr,
  (select c.id from categories c where lower(c.name) = lower(l.cat) limit 1), l.station, l.cuisine, l.veg,
  coalesce(l.price * 100, 1), 'new', l.sort, l.price is not null, l.price is not null
from matched l where l.live_id is null;

insert into option_groups (menu_item_id, name, required, max_choices, sort_order)
select m.id, 'Bread', true, 1, 1 from menu_items m where m.slug = 'chhole-with-choice-of-bread'
  and not exists (select 1 from option_groups g where g.menu_item_id = m.id);
insert into options (option_group_id, name, sort_order)
select g.id, v.name, v.sort from option_groups g join menu_items m on m.id = g.menu_item_id, (values ('2 Ghar ka Parantha', 1), ('2 Malabar Parantha', 2), ('4 Tawa Roti', 3)) as v(name, sort)
where m.slug = 'chhole-with-choice-of-bread' and g.name = 'Bread' and not exists (select 1 from options o where o.option_group_id = g.id);

\if :{?retire}
update menu_items x set active = false, available = false, updated_at = now()
where x.active and x.slug not in (select slug from locked)
  and x.id not in (select live_id from matched where live_id is not null);
\echo '-- old dishes taken off (hidden, kept with their history)'
\endif

-- A dish that is off the menu must not stay pickable as the other half of a
-- half & half pizza. Runs every time, so it also tidies after manual removals.
delete from options o using option_groups g, menu_items gone
where o.option_group_id = g.id and g.name ilike '%half%'
  and lower(o.name) = lower(gone.name) and not gone.active
  and not exists (select 1 from menu_items live where lower(live.name) = lower(o.name) and live.active);
-- …and the renamed pizza's half & half choice takes its new name.
update options o set name = l.name
from matched l join menu_items x on x.id = l.live_id, option_groups g
where o.option_group_id = g.id and g.name ilike '%half%' and l.alias = 'rosemary-chicken-verde'
  and lower(o.name) = 'rosemary chicken verde';

\echo '== After this run =='
select count(*) filter (where active) as "dishes showing", count(*) filter (where not active and price_paise < 100) as "waiting for a price"
from menu_items;

\if :{?apply}
commit;
\echo 'APPLIED.'
\else
rollback;
\echo 'PREVIEW ONLY: nothing was changed. Add -v apply=1 to make these changes.'
\endif
