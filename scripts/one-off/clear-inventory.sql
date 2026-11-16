-- ONE-OFF, owner request 17 Nov 2026: wipe the inventory item list to rebuild it
-- from real purchases. Deletes every ingredient, every recipe ingredient line,
-- every purchase-order line and the whole stock ledger. Recipe methods/photos
-- stay. Take a backup first (see the commit message). Never run automatically.
begin;
update expenses set ingredient_id = null, quantity = null where ingredient_id is not null;
update spend_lines set ingredient_id = null where ingredient_id is not null;
delete from purchase_order_lines;
delete from recipe_lines;
delete from stock_movements;
delete from ingredients;
select (select count(*) from ingredients) as items_left, (select count(*) from recipe_lines) as recipe_lines_left, (select count(*) from stock_movements) as movements_left;
commit;
