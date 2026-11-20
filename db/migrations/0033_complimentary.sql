-- An order given free (tasting, a hotel partner, a make-good). The food still
-- goes out and comes off stock; the bill is zero, the menu value is kept as a
-- discount so Day Close can say what was given away, and why.
alter table orders add column if not exists comp_reason text;
alter table orders add column if not exists comp_by uuid references staff_users (id);
