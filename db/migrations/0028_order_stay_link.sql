-- Tie an order to a real place.
--
-- Guests typed their hotel's name, and the rider's Maps link searched for that
-- text — a typo or a "near the lake" sent them the wrong way. The Stay
-- Directory already holds every hotel's Google place and coordinates, so the
-- checkout now offers those names, and the order remembers which one was
-- picked. Navigation opens that exact Google place.
--
-- The guest's own GPS pin stays, now with how accurate the phone said it was:
-- a 1.5 km "pin" from indoors is worse than the hotel's own location, and
-- without the accuracy we couldn't tell the two apart.

alter table orders add column if not exists stay_id uuid references stays (id) on delete set null;
alter table orders add column if not exists location_accuracy_m integer
  check (location_accuracy_m is null or location_accuracy_m >= 0);
