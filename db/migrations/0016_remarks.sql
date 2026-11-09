-- Remarks. `description` on an expense is what it was for; this is the story
-- behind it — "paid half now, rest on Friday", "rate up ₹20/kg this week".
-- Vendors already had `notes`; bills and expenses did not.
alter table expenses add column if not exists note text;
alter table vendor_bills add column if not exists note text;

-- A line the kitchen must read on the ticket: an allergy, a repeat customer,
-- "ring from the gate". Set by staff on the order, separate from the
-- customer's own `notes`, which they typed themselves.
alter table orders add column if not exists kitchen_note text;
