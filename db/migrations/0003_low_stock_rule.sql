-- Only flag low stock once a reorder level has been set for the ingredient.
create or replace view stock_on_hand as
  select i.id as ingredient_id, i.name, i.unit, i.reorder_level,
         coalesce(sum(m.quantity), 0) as on_hand,
         (i.reorder_level > 0 and coalesce(sum(m.quantity), 0) <= i.reorder_level) as is_low
  from ingredients i
  left join stock_movements m on m.ingredient_id = i.id
  where i.active
  group by i.id;
