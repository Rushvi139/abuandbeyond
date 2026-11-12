-- When an expense is for a stock ingredient (oil, tomatoes, packaging…),
-- link it to that ingredient so the system can auto-create a stock_movement
-- of kind 'purchase' instead of requiring a separate manual entry.
--
-- quantity is in the ingredient's own base unit (g / ml / pc).
-- Both are nullable: most expenses are non-stock items and that's fine.

alter table expenses
  add column if not exists ingredient_id uuid references ingredients (id),
  add column if not exists quantity numeric(12,3) check (quantity is null or quantity > 0);

-- Make it easy to list "which expenses moved this ingredient"
create index if not exists expenses_ingredient_idx on expenses (ingredient_id) where ingredient_id is not null;
